import { createHash } from "node:crypto";
import path from "node:path";
import ExcelJS, { type Cell, type Worksheet } from "exceljs";

export class WorkbookImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookImportError";
  }
}

export type ImportedLog = {
  sequenceNo: number | null;
  cargo: string | null;
  logNo: string;
  normalizedLogNo: string;
  lengthM: number | null;
  diameterCm: number | null;
  volumeCbm: number | null;
  sourceRow: number;
  rowData: Record<string, string | number | boolean | null>;
};

export type ParsedWorkbook = {
  listCode: string;
  originalFilename: string;
  sourceSha256: string;
  sheetName: string;
  headerRow: number;
  totalRows: number;
  duplicateRows: number;
  totalVolumeCbm: number;
  inferredWoodSpecies: string | null;
  logs: ImportedLog[];
};

type HeaderKey =
  | "sequence"
  | "cargo"
  | "logNo"
  | "length"
  | "diameter"
  | "volume";

type HeaderMatch = {
  worksheet: Worksheet;
  rowNumber: number;
  score: number;
  columns: Partial<Record<HeaderKey, number>>;
};

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  sequence: ["no", "number", "stt", "so thu tu"],
  cargo: ["cargo", "wood", "species", "wood species", "loai go", "ten go"],
  logNo: ["log no", "log number", "log", "so log", "ma log", "log id"],
  length: ["lg m", "length m", "length", "chieu dai m", "dai m"],
  diameter: [
    "omoy cm",
    "diameter cm",
    "diameter",
    "duong kinh cm",
    "d moy cm",
    "moy cm"
  ],
  volume: ["vol cbm", "volume cbm", "cbm", "vol m3", "volume m3", "the tich"]
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/[Øø]/g, "o")
    .replace(/[Đđ]/g, "d")
    .replace(/³/g, "3")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeLogNo(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function findColumn(headers: string[], key: HeaderKey): number | undefined {
  const normalizedHeaders = headers.map(normalizeHeader);
  const aliases = HEADER_ALIASES[key];
  const exactIndex = normalizedHeaders.findIndex((header) => aliases.includes(header));

  if (exactIndex >= 0) {
    return exactIndex + 1;
  }

  const partialIndex = normalizedHeaders.findIndex((header) => {
    if (!header) {
      return false;
    }

    if (key === "logNo") {
      return header.includes("log") && (header.includes("no") || header === "log");
    }

    if (key === "volume") {
      return header.includes("cbm") || header.includes("volume");
    }

    if (key === "diameter") {
      return header.includes("diameter") || header.includes("moy");
    }

    if (key === "length") {
      return header.includes("length") || header.startsWith("lg ");
    }

    return false;
  });

  return partialIndex >= 0 ? partialIndex + 1 : undefined;
}

function detectHeader(worksheet: Worksheet): HeaderMatch | null {
  let best: HeaderMatch | null = null;
  const rowsToScan = Math.min(worksheet.rowCount, 25);
  const columnsToScan = Math.max(worksheet.columnCount, 1);

  for (let rowNumber = 1; rowNumber <= rowsToScan; rowNumber += 1) {
    const headers = Array.from({ length: columnsToScan }, (_, index) =>
      worksheet.getCell(rowNumber, index + 1).text.trim()
    );
    const columns: Partial<Record<HeaderKey, number>> = {};

    for (const key of Object.keys(HEADER_ALIASES) as HeaderKey[]) {
      columns[key] = findColumn(headers, key);
    }

    if (!columns.logNo) {
      continue;
    }

    const score =
      10 +
      (columns.volume ? 4 : 0) +
      (columns.sequence ? 2 : 0) +
      (columns.cargo ? 2 : 0) +
      (columns.length ? 1 : 0) +
      (columns.diameter ? 1 : 0);

    if (!best || score > best.score) {
      best = { worksheet, rowNumber, score, columns };
    }
  }

  return best;
}

function cellValue(cell: Cell): string | number | boolean | null {
  const value = cell.value;

  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return cell.text.trim() || null;
}

function parseNumber(cell: Cell | undefined): number | null {
  if (!cell) {
    return null;
  }

  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return cell.value;
  }

  let text = cell.text.trim().replace(/\s/g, "");

  if (!text) {
    return null;
  }

  if (text.includes(",") && text.includes(".")) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueHeaders(worksheet: Worksheet, rowNumber: number): string[] {
  const counts = new Map<string, number>();

  return Array.from({ length: worksheet.columnCount }, (_, index) => {
    const raw = worksheet.getCell(rowNumber, index + 1).text.trim();
    const base = raw || "Column " + (index + 1);
    const nextCount = (counts.get(base) ?? 0) + 1;
    counts.set(base, nextCount);
    return nextCount === 1 ? base : base + " (" + nextCount + ")";
  });
}

function extractListCode(originalFilename: string): string {
  const baseName = path.parse(originalFilename).name.trim();
  const normalized = baseName.toUpperCase();
  const knownCode = normalized.match(/\b[A-Z]{2}\d{4}[A-Z]{2,6}\d{2}\b/);
  return knownCode?.[0] ?? baseName;
}

function inferWoodSpecies(logs: ImportedLog[]): string | null {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const cargo = log.cargo?.trim();

    if (cargo) {
      counts.set(cargo, (counts.get(cargo) ?? 0) + 1);
    }
  }

  return (
    [...counts.entries()].sort(
      ([leftCargo, leftCount], [rightCargo, rightCount]) =>
        rightCount - leftCount || leftCargo.localeCompare(rightCargo, "vi")
    )[0]?.[0] ?? null
  );
}

export async function parseWorkbook(
  buffer: Buffer,
  originalFilename: string
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
  } catch {
    throw new WorkbookImportError(
      "Không thể đọc file Excel. Vui lòng dùng file .xlsx hợp lệ."
    );
  }

  const matches = workbook.worksheets
    .map(detectHeader)
    .filter((match): match is HeaderMatch => match !== null)
    .sort((left, right) => right.score - left.score);
  const match = matches[0];

  if (!match?.columns.logNo) {
    throw new WorkbookImportError(
      "Không tìm thấy cột Log No. trong 25 dòng đầu của workbook."
    );
  }

  const { worksheet, columns, rowNumber: headerRow } = match;
  const logColumn = columns.logNo;

  if (!logColumn) {
    throw new WorkbookImportError("Không tìm thấy cột Log No.");
  }
  const headers = uniqueHeaders(worksheet, headerRow);
  const seenLogNumbers = new Set<string>();
  const logs: ImportedLog[] = [];
  let totalRows = 0;
  let duplicateRows = 0;

  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const combinedText = Array.from(
      { length: worksheet.columnCount },
      (_, index) => row.getCell(index + 1).text
    ).join(" ");
    const normalizedCombined = normalizeHeader(combinedText);

    if (/\b(total|average|tong|trung binh)\b/.test(normalizedCombined)) {
      continue;
    }

    const logNo = row.getCell(logColumn).text.trim();
    const normalizedLogNo = normalizeLogNo(logNo);

    if (!normalizedLogNo) {
      continue;
    }

    const sequenceNo = columns.sequence
      ? parseNumber(row.getCell(columns.sequence))
      : null;

    if (columns.sequence && (sequenceNo === null || sequenceNo <= 0)) {
      continue;
    }

    totalRows += 1;

    if (seenLogNumbers.has(normalizedLogNo)) {
      duplicateRows += 1;
      continue;
    }

    seenLogNumbers.add(normalizedLogNo);

    const rowData: Record<string, string | number | boolean | null> = {};

    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      const value = cellValue(row.getCell(column));

      if (value !== null && value !== "") {
        rowData[headers[column - 1]] = value;
      }
    }

    logs.push({
      sequenceNo: sequenceNo === null ? null : Math.trunc(sequenceNo),
      cargo: columns.cargo ? row.getCell(columns.cargo).text.trim() || null : null,
      logNo,
      normalizedLogNo,
      lengthM: columns.length ? parseNumber(row.getCell(columns.length)) : null,
      diameterCm: columns.diameter
        ? parseNumber(row.getCell(columns.diameter))
        : null,
      volumeCbm: columns.volume ? parseNumber(row.getCell(columns.volume)) : null,
      sourceRow: rowNumber,
      rowData
    });
  }

  if (logs.length === 0) {
    throw new WorkbookImportError(
      "Đã tìm thấy cột Log No. nhưng không có dòng cây gỗ hợp lệ."
    );
  }

  return {
    listCode: extractListCode(originalFilename),
    originalFilename,
    sourceSha256: createHash("sha256").update(buffer).digest("hex"),
    sheetName: worksheet.name,
    headerRow,
    totalRows,
    duplicateRows,
    totalVolumeCbm: logs.reduce((sum, log) => sum + (log.volumeCbm ?? 0), 0),
    inferredWoodSpecies: inferWoodSpecies(logs),
    logs
  };
}
