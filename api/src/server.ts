import { createHash } from "node:crypto";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response
} from "express";
import multer from "multer";
import type { Pool, PoolClient } from "pg";
import { pool } from "./db.js";
import {
  normalizeLogNo,
  parseWorkbook,
  WorkbookImportError
} from "./importer.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const expectedApiKey = process.env.APP_API_KEY?.trim();
const allowedOrigins = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

type QueryExecutor = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type DatabaseRow = Record<string, unknown>;

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (/\.xlsx$/i.test(file.originalname)) {
      callback(null, true);
      return;
    }

    callback(new WorkbookImportError("Ứng dụng hiện nhận file Excel định dạng .xlsx."));
  }
});

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (allowedTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Ảnh phải có định dạng JPEG, PNG hoặc WebP."));
  }
});

const LOG_SELECT = `
  SELECT
    l.id,
    l.import_id,
    l.sequence_no,
    l.cargo,
    l.log_no,
    l.length_m,
    l.diameter_cm,
    l.volume_cbm,
    l.source_row,
    l.status,
    l.received_at,
    i.list_code,
    i.original_filename,
    (
      SELECT count(*)::int
      FROM wood_log_photos p
      WHERE p.log_id = l.id
    ) AS photo_count,
    (
      SELECT p.id
      FROM wood_log_photos p
      WHERE p.log_id = l.id
      ORDER BY p.created_at DESC
      LIMIT 1
    ) AS latest_photo_id
  FROM wood_logs l
  JOIN wood_imports i ON i.id = l.import_id
`;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapLog(row: DatabaseRow) {
  return {
    id: row.id,
    importId: row.import_id,
    listCode: row.list_code,
    originalFilename: row.original_filename,
    sequenceNo: asNumber(row.sequence_no),
    cargo: row.cargo,
    logNo: row.log_no,
    lengthM: asNumber(row.length_m),
    diameterCm: asNumber(row.diameter_cm),
    volumeCbm: asNumber(row.volume_cbm),
    sourceRow: asNumber(row.source_row),
    status: row.status,
    receivedAt: row.received_at,
    photoCount: asNumber(row.photo_count) ?? 0,
    latestPhotoId: row.latest_photo_id
  };
}

function mapImport(row: DatabaseRow) {
  const totalLogs = asNumber(row.total_logs ?? row.imported_rows) ?? 0;
  const receivedLogs = asNumber(row.received_logs) ?? 0;

  return {
    id: row.id,
    listCode: row.list_code,
    originalFilename: row.original_filename,
    sheetName: row.sheet_name,
    headerRow: asNumber(row.header_row),
    totalRows: asNumber(row.total_rows) ?? 0,
    importedRows: asNumber(row.imported_rows) ?? 0,
    duplicateRows: asNumber(row.duplicate_rows) ?? 0,
    totalVolumeCbm: asNumber(row.total_volume_cbm) ?? 0,
    totalLogs,
    receivedLogs,
    pendingLogs: Math.max(totalLogs - receivedLogs, 0),
    createdAt: row.created_at
  };
}

async function getImportSummary(executor: QueryExecutor, id: string) {
  const result = await executor.query(
    `
      SELECT
        i.*,
        count(l.id)::int AS total_logs,
        count(l.id) FILTER (WHERE l.status = 'received')::int AS received_logs
      FROM wood_imports i
      LEFT JOIN wood_logs l ON l.import_id = i.id
      WHERE i.id = $1
      GROUP BY i.id
    `,
    [id]
  );

  return result.rows[0] ? mapImport(result.rows[0] as DatabaseRow) : null;
}

app.disable("x-powered-by");
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "app-nhap-go-api" });
});

app.get("/health/db", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ ok: true, database: "connected" });
});

app.use("/api", (request, response, next) => {
  if (!expectedApiKey || request.header("x-api-key") === expectedApiKey) {
    next();
    return;
  }

  response.status(401).json({ message: "API key không hợp lệ." });
});

app.get("/api/imports", async (_request, response) => {
  const result = await pool.query(
    `
      SELECT
        i.*,
        count(l.id)::int AS total_logs,
        count(l.id) FILTER (WHERE l.status = 'received')::int AS received_logs
      FROM wood_imports i
      LEFT JOIN wood_logs l ON l.import_id = i.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT 50
    `
  );

  response.json({ imports: result.rows.map((row) => mapImport(row as DatabaseRow)) });
});

app.post("/api/imports", importUpload.single("file"), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn file Excel .xlsx." });
    return;
  }

  const parsed = await parseWorkbook(request.file.buffer, request.file.originalname);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id FROM wood_imports WHERE source_sha256 = $1",
      [parsed.sourceSha256]
    );

    if (existing.rows[0]) {
      const summary = await getImportSummary(client, existing.rows[0].id as string);
      await client.query("COMMIT");
      response.status(200).json({
        duplicateFile: true,
        message: "File này đã được nhập trước đó.",
        import: summary
      });
      return;
    }

    const importResult = await client.query(
      `
        INSERT INTO wood_imports (
          list_code,
          original_filename,
          source_sha256,
          sheet_name,
          header_row,
          total_rows,
          imported_rows,
          duplicate_rows,
          total_volume_cbm
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      [
        parsed.listCode,
        parsed.originalFilename,
        parsed.sourceSha256,
        parsed.sheetName,
        parsed.headerRow,
        parsed.totalRows,
        parsed.logs.length,
        parsed.duplicateRows,
        parsed.totalVolumeCbm
      ]
    );
    const importId = importResult.rows[0].id as string;

    for (const log of parsed.logs) {
      await client.query(
        `
          INSERT INTO wood_logs (
            import_id,
            sequence_no,
            cargo,
            log_no,
            normalized_log_no,
            length_m,
            diameter_cm,
            volume_cbm,
            source_row,
            row_data
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        `,
        [
          importId,
          log.sequenceNo,
          log.cargo,
          log.logNo,
          log.normalizedLogNo,
          log.lengthM,
          log.diameterCm,
          log.volumeCbm,
          log.sourceRow,
          JSON.stringify(log.rowData)
        ]
      );
    }

    const summary = await getImportSummary(client, importId);
    await client.query("COMMIT");
    response.status(201).json({
      duplicateFile: false,
      message: "Đã nhập danh sách gỗ thành công.",
      import: summary
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.get("/api/imports/:id/logs", async (request, response) => {
  const status = String(request.query.status ?? "").trim();
  const search = normalizeLogNo(request.query.search);
  const values: unknown[] = [request.params.id];
  const clauses = ["l.import_id = $1"];

  if (status === "pending" || status === "received") {
    values.push(status);
    clauses.push("l.status = $" + values.length);
  }

  if (search) {
    values.push("%" + search + "%");
    clauses.push("l.normalized_log_no LIKE $" + values.length);
  }

  const result = await pool.query(
    LOG_SELECT +
      " WHERE " +
      clauses.join(" AND ") +
      " ORDER BY l.sequence_no NULLS LAST, l.log_no LIMIT 500",
    values
  );

  response.json({ logs: result.rows.map((row) => mapLog(row as DatabaseRow)) });
});

app.get("/api/logs/search", async (request, response) => {
  const query = normalizeLogNo(request.query.logNo);

  if (!query) {
    response.status(400).json({ message: "Vui lòng nhập số Log." });
    return;
  }

  const result = await pool.query(
    LOG_SELECT +
      `
        WHERE l.normalized_log_no = $1
           OR l.normalized_log_no LIKE $2
        ORDER BY
          CASE WHEN l.normalized_log_no = $1 THEN 0 ELSE 1 END,
          i.created_at DESC
        LIMIT 30
      `,
    [query, "%" + query + "%"]
  );

  response.json({ logs: result.rows.map((row) => mapLog(row as DatabaseRow)) });
});

app.post(
  "/api/logs/:id/photos",
  photoUpload.single("photo"),
  async (request, response) => {
    if (!request.file) {
      response.status(400).json({ message: "Vui lòng chụp hoặc chọn một ảnh." });
      return;
    }

    const client = await pool.connect();
    const sha256 = createHash("sha256").update(request.file.buffer).digest("hex");
    const requestedDate = new Date(String(request.body.capturedAt ?? ""));
    const capturedAt = Number.isNaN(requestedDate.getTime())
      ? new Date()
      : requestedDate;

    try {
      await client.query("BEGIN");
      const logResult = await client.query(
        "SELECT id FROM wood_logs WHERE id = $1 FOR UPDATE",
        [request.params.id]
      );

      if (!logResult.rows[0]) {
        await client.query("ROLLBACK");
        response.status(404).json({ message: "Không tìm thấy cây gỗ này." });
        return;
      }

      const insertedPhoto = await client.query(
        `
          INSERT INTO wood_log_photos (
            log_id,
            photo_data,
            mime_type,
            original_filename,
            byte_size,
            sha256,
            captured_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (log_id, sha256) DO NOTHING
          RETURNING id
        `,
        [
          request.params.id,
          request.file.buffer,
          request.file.mimetype,
          request.file.originalname,
          request.file.size,
          sha256,
          capturedAt
        ]
      );

      let photoId = insertedPhoto.rows[0]?.id as string | undefined;

      if (!photoId) {
        const existingPhoto = await client.query(
          "SELECT id FROM wood_log_photos WHERE log_id = $1 AND sha256 = $2",
          [request.params.id, sha256]
        );
        photoId = existingPhoto.rows[0].id as string;
      }

      await client.query(
        `
          UPDATE wood_logs
          SET
            status = 'received',
            received_at = COALESCE(received_at, $2),
            updated_at = now()
          WHERE id = $1
        `,
        [request.params.id, capturedAt]
      );
      const photoCountResult = await client.query(
        "SELECT count(*)::int AS count FROM wood_log_photos WHERE log_id = $1",
        [request.params.id]
      );
      await client.query("COMMIT");

      response.status(insertedPhoto.rows[0] ? 201 : 200).json({
        message: insertedPhoto.rows[0]
          ? "Đã lưu ảnh và xác nhận cây về kho."
          : "Ảnh này đã được lưu trước đó.",
        photoId,
        photoCount: Number(photoCountResult.rows[0].count),
        status: "received"
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
);

app.get("/api/photos/:id", async (request, response) => {
  const result = await pool.query(
    `
      SELECT photo_data, mime_type, byte_size
      FROM wood_log_photos
      WHERE id = $1
    `,
    [request.params.id]
  );
  const photo = result.rows[0];

  if (!photo) {
    response.status(404).json({ message: "Không tìm thấy ảnh." });
    return;
  }

  response.setHeader("Content-Type", photo.mime_type);
  response.setHeader("Content-Length", String(photo.byte_size));
  response.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  response.send(photo.photo_data);
});

app.use(
  (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File vượt quá dung lượng cho phép."
          : error.message;
      response.status(400).json({ message });
      return;
    }

    if (error instanceof WorkbookImportError) {
      response.status(400).json({ message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Lỗi không xác định.";
    console.error("Request failed:", message);
    response.status(500).json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." });
  }
);

const server = app.listen(port, "0.0.0.0", () => {
  console.log("appNhapGo API listening on port " + port);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
