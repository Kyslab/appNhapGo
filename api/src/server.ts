import { createHash } from "node:crypto";
import { Readable } from "node:stream";
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
import {
  ImportDetailsError,
  parseImportDetails,
  parseImportFilename
} from "./import-details.js";
import { parseVehiclePlate, VehiclePlateError } from "./intake-details.js";

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
    l.vehicle_plate,
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
    vehiclePlate: row.vehicle_plate,
    receivedAt: row.received_at,
    photoCount: asNumber(row.photo_count) ?? 0,
    latestPhotoId: row.latest_photo_id
  };
}

function mapPhoto(row: DatabaseRow) {
  return {
    id: row.id,
    logId: row.log_id,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    byteSize: asNumber(row.byte_size) ?? 0,
    vehiclePlate: row.vehicle_plate,
    capturedAt: row.captured_at,
    createdAt: row.created_at
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
    shipmentType: row.shipment_type,
    ownerName: row.owner_name,
    contactPhone: row.contact_phone,
    lotName: row.lot_name,
    vesselName: row.vessel_name,
    woodSpecies: row.wood_species,
    container20Count: asNumber(row.container_20_count),
    container40Count: asNumber(row.container_40_count),
    containerPickupLocation: row.container_pickup_location,
    woodPickupLocation: row.wood_pickup_location,
    intakeStartDate: row.intake_start_date,
    totalQuantity: asNumber(row.total_quantity),
    quantityUnit: row.quantity_unit,
    declaredVolumeCbm: asNumber(row.declared_volume_cbm),
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

app.put("/api/imports/:id", async (request, response) => {
  const details = parseImportDetails(request.body);
  const originalFilename = parseImportFilename(request.body);
  const result = await pool.query(
    `
      UPDATE wood_imports
      SET
        original_filename = $2,
        shipment_type = $3,
        owner_name = $4,
        contact_phone = $5,
        lot_name = $6,
        vessel_name = $7,
        wood_species = $8,
        container_20_count = $9,
        container_40_count = $10,
        container_pickup_location = $11,
        wood_pickup_location = $12,
        intake_start_date = $13,
        total_quantity = $14,
        quantity_unit = $15,
        declared_volume_cbm = $16
      WHERE id = $1
      RETURNING id
    `,
    [
      request.params.id,
      originalFilename,
      details.shipmentType,
      details.ownerName,
      details.contactPhone,
      details.lotName,
      details.vesselName,
      details.woodSpecies,
      details.container20Count,
      details.container40Count,
      details.containerPickupLocation,
      details.woodPickupLocation,
      details.intakeStartDate,
      details.totalQuantity,
      details.quantityUnit,
      details.declaredVolumeCbm
    ]
  );

  if (!result.rows[0]) {
    response.status(404).json({ message: "Không tìm thấy file cần sửa." });
    return;
  }

  response.json({
    message: "Đã cập nhật thông tin file.",
    import: await getImportSummary(pool, request.params.id)
  });
});

app.delete("/api/imports/:id", async (request, response) => {
  const result = await pool.query(
    `
      DELETE FROM wood_imports
      WHERE id = $1
      RETURNING id, original_filename
    `,
    [request.params.id]
  );

  if (!result.rows[0]) {
    response.status(404).json({ message: "Không tìm thấy file cần xóa." });
    return;
  }

  response.json({
    message: "Đã xóa file và toàn bộ dữ liệu liên quan.",
    deletedImportId: result.rows[0].id,
    originalFilename: result.rows[0].original_filename
  });
});

app.get("/api/warehouse", async (_request, response) => {
  const [summaryResult, logsResult] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM wood_imports) AS total_imports,
        (SELECT count(*)::int FROM wood_logs) AS total_logs,
        (
          SELECT count(*)::int
          FROM wood_logs
          WHERE status = 'received'
        ) AS received_logs,
        (SELECT count(*)::int FROM wood_log_photos) AS photo_count
    `),
    pool.query(
      LOG_SELECT +
        `
          WHERE l.status = 'received'
          ORDER BY l.received_at DESC NULLS LAST, l.updated_at DESC
          LIMIT 300
        `
    )
  ]);
  const summary = summaryResult.rows[0] as DatabaseRow;
  const totalLogs = asNumber(summary.total_logs) ?? 0;
  const receivedLogs = asNumber(summary.received_logs) ?? 0;

  response.json({
    summary: {
      totalImports: asNumber(summary.total_imports) ?? 0,
      totalLogs,
      receivedLogs,
      pendingLogs: Math.max(totalLogs - receivedLogs, 0),
      photoCount: asNumber(summary.photo_count) ?? 0
    },
    logs: logsResult.rows.map((row) => mapLog(row as DatabaseRow))
  });
});

async function handleWorkbookImport(request: Request, response: Response) {
  if (!request.file) {
    response.status(400).json({ message: "Vui lòng chọn file Excel .xlsx." });
    return;
  }

  const details = parseImportDetails(request.body);
  const parsed = await parseWorkbook(
    request.file.buffer,
    request.file.originalname
  );
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
          total_volume_cbm,
          shipment_type,
          owner_name,
          contact_phone,
          lot_name,
          vessel_name,
          wood_species,
          container_20_count,
          container_40_count,
          container_pickup_location,
          wood_pickup_location,
          intake_start_date,
          total_quantity,
          quantity_unit,
          declared_volume_cbm
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
        )
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
        parsed.totalVolumeCbm,
        details.shipmentType,
        details.ownerName,
        details.contactPhone,
        details.lotName,
        details.vesselName,
        details.woodSpecies,
        details.container20Count,
        details.container40Count,
        details.containerPickupLocation,
        details.woodPickupLocation,
        details.intakeStartDate,
        details.totalQuantity,
        details.quantityUnit,
        details.declaredVolumeCbm
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
}

app.post("/api/imports", importUpload.single("file"), handleWorkbookImport);

app.post(
  "/api/imports/raw",
  express.raw({ type: () => true, limit: "20mb" }),
  async (request, response) => {
    const originalFilename = parseImportFilename({
      originalFilename: request.query.originalFilename
    });

    if (!/\.xlsx$/i.test(originalFilename)) {
      throw new WorkbookImportError(
        "Ứng dụng hiện nhận file Excel định dạng .xlsx."
      );
    }

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new WorkbookImportError("File Excel không có dữ liệu.");
    }

    request.file = {
      fieldname: "file",
      originalname: originalFilename,
      encoding: "7bit",
      mimetype:
        request.header("content-type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: request.body.length,
      stream: Readable.from(request.body),
      buffer: request.body,
      destination: "",
      filename: originalFilename,
      path: ""
    };
    request.body = { ...request.query };

    await handleWorkbookImport(request, response);
  }
);

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

app.get("/api/logs/:id/photos", async (request, response) => {
  const result = await pool.query(
    `
      SELECT
        id,
        log_id,
        mime_type,
        original_filename,
        byte_size,
        vehicle_plate,
        captured_at,
        created_at
      FROM wood_log_photos
      WHERE log_id = $1
      ORDER BY captured_at DESC, created_at DESC
    `,
    [request.params.id]
  );

  response.json({
    photos: result.rows.map((row) => mapPhoto(row as DatabaseRow))
  });
});

app.post(
  "/api/logs/:id/photos",
  photoUpload.single("photo"),
  async (request, response) => {
    if (!request.file) {
      response.status(400).json({ message: "Vui lòng chụp hoặc chọn một ảnh." });
      return;
    }

    const sha256 = createHash("sha256").update(request.file.buffer).digest("hex");
    const requestedDate = new Date(String(request.body.capturedAt ?? ""));
    const capturedAt = Number.isNaN(requestedDate.getTime())
      ? new Date()
      : requestedDate;
    const vehiclePlate = parseVehiclePlate(request.body.vehiclePlate);
    const client = await pool.connect();

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
            vehicle_plate,
            captured_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
          vehiclePlate,
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

      const updatedLog = await client.query(
        `
          UPDATE wood_logs
          SET
            status = 'received',
            received_at = COALESCE(received_at, $2),
            vehicle_plate = COALESCE($3, vehicle_plate),
            updated_at = now()
          WHERE id = $1
          RETURNING received_at, vehicle_plate
        `,
        [request.params.id, capturedAt, vehiclePlate]
      );
      const photoCountResult = await client.query(
        `
          SELECT
            count(*)::int AS count,
            (
              SELECT id
              FROM wood_log_photos
              WHERE log_id = $1
              ORDER BY captured_at DESC, created_at DESC
              LIMIT 1
            ) AS latest_photo_id
          FROM wood_log_photos
          WHERE log_id = $1
        `,
        [request.params.id]
      );
      await client.query("COMMIT");

      response.status(insertedPhoto.rows[0] ? 201 : 200).json({
        message: insertedPhoto.rows[0]
          ? "Đã lưu ảnh và xác nhận cây về kho."
          : "Ảnh này đã được lưu trước đó.",
        photoId,
        photoCount: Number(photoCountResult.rows[0].count),
        latestPhotoId: photoCountResult.rows[0].latest_photo_id,
        status: "received",
        receivedAt: updatedLog.rows[0].received_at,
        vehiclePlate: updatedLog.rows[0].vehicle_plate
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
);

app.put(
  "/api/photos/:id",
  photoUpload.single("photo"),
  async (request, response) => {
    if (!request.file) {
      response.status(400).json({ message: "Vui lòng chụp hoặc chọn một ảnh." });
      return;
    }

    const sha256 = createHash("sha256").update(request.file.buffer).digest("hex");
    const requestedDate = new Date(String(request.body.capturedAt ?? ""));
    const capturedAt = Number.isNaN(requestedDate.getTime())
      ? new Date()
      : requestedDate;
    const vehiclePlate = parseVehiclePlate(request.body.vehiclePlate);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const photoResult = await client.query(
        "SELECT log_id FROM wood_log_photos WHERE id = $1 FOR UPDATE",
        [request.params.id]
      );
      const logId = photoResult.rows[0]?.log_id as string | undefined;

      if (!logId) {
        await client.query("ROLLBACK");
        response.status(404).json({ message: "Không tìm thấy ảnh cần thay." });
        return;
      }

      const duplicateResult = await client.query(
        `
          SELECT id
          FROM wood_log_photos
          WHERE log_id = $1 AND sha256 = $2 AND id <> $3
        `,
        [logId, sha256, request.params.id]
      );

      if (duplicateResult.rows[0]) {
        await client.query("ROLLBACK");
        response.status(409).json({
          message: "Ảnh mới đã tồn tại trong cây gỗ này."
        });
        return;
      }

      await client.query(
        `
          UPDATE wood_log_photos
          SET
            photo_data = $2,
            mime_type = $3,
            original_filename = $4,
            byte_size = $5,
            sha256 = $6,
            captured_at = $7,
            vehicle_plate = COALESCE($8, vehicle_plate)
          WHERE id = $1
        `,
        [
          request.params.id,
          request.file.buffer,
          request.file.mimetype,
          request.file.originalname,
          request.file.size,
          sha256,
          capturedAt,
          vehiclePlate
        ]
      );
      const updatedLog = await client.query(
        `
          UPDATE wood_logs
          SET
            status = 'received',
            received_at = COALESCE(received_at, $2),
            vehicle_plate = COALESCE($3, vehicle_plate),
            updated_at = now()
          WHERE id = $1
          RETURNING received_at, vehicle_plate
        `,
        [logId, capturedAt, vehiclePlate]
      );
      const countResult = await client.query(
        "SELECT count(*)::int AS count FROM wood_log_photos WHERE log_id = $1",
        [logId]
      );
      await client.query("COMMIT");

      response.json({
        message: "Đã thay ảnh cây gỗ.",
        photoId: request.params.id,
        photoCount: Number(countResult.rows[0].count),
        latestPhotoId: request.params.id,
        status: "received",
        receivedAt: updatedLog.rows[0].received_at,
        vehiclePlate: updatedLog.rows[0].vehicle_plate
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
);

app.delete("/api/photos/:id", async (request, response) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const photoResult = await client.query(
      "SELECT log_id FROM wood_log_photos WHERE id = $1 FOR UPDATE",
      [request.params.id]
    );
    const logId = photoResult.rows[0]?.log_id as string | undefined;

    if (!logId) {
      await client.query("ROLLBACK");
      response.status(404).json({ message: "Không tìm thấy ảnh cần xóa." });
      return;
    }

    await client.query("DELETE FROM wood_log_photos WHERE id = $1", [
      request.params.id
    ]);
    const remainingResult = await client.query(
      `
        SELECT id, vehicle_plate, captured_at
        FROM wood_log_photos
        WHERE log_id = $1
        ORDER BY captured_at DESC, created_at DESC
      `,
      [logId]
    );
    const photoCount = remainingResult.rowCount ?? 0;
    const status = photoCount > 0 ? "received" : "pending";
    const oldestPhoto = remainingResult.rows[photoCount - 1];
    const vehiclePlate = remainingResult.rows.find(
      (row) => row.vehicle_plate
    )?.vehicle_plate ?? null;
    const receivedAt = oldestPhoto?.captured_at ?? null;

    await client.query(
      `
        UPDATE wood_logs
        SET
          status = $2,
          received_at = $3,
          vehicle_plate = $4,
          updated_at = now()
        WHERE id = $1
      `,
      [logId, status, receivedAt, vehiclePlate]
    );
    await client.query("COMMIT");

    response.json({
      message: "Đã xóa ảnh cây gỗ.",
      deletedPhotoId: request.params.id,
      photoCount,
      latestPhotoId: (remainingResult.rows[0]?.id as string | undefined) ?? null,
      status,
      receivedAt,
      vehiclePlate
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

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
  response.setHeader("Cache-Control", "private, no-store");
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

    if (
      error instanceof WorkbookImportError ||
      error instanceof ImportDetailsError ||
      error instanceof VehiclePlateError
    ) {
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
