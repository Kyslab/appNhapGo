export type LogStatus = "pending" | "received";

export type WoodLog = {
  id: string;
  importId: string;
  listCode: string;
  originalFilename: string;
  sequenceNo: number | null;
  cargo: string | null;
  logNo: string;
  lengthM: number | null;
  diameterCm: number | null;
  volumeCbm: number | null;
  sourceRow: number | null;
  status: LogStatus;
  receivedAt: string | null;
  photoCount: number;
  latestPhotoId: string | null;
};

export type WoodImport = {
  id: string;
  listCode: string;
  originalFilename: string;
  sheetName: string;
  headerRow: number;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  totalVolumeCbm: number;
  totalLogs: number;
  receivedLogs: number;
  pendingLogs: number;
  createdAt: string;
};

export type PhotoFile = {
  uri: string;
  name: string;
  mimeType: string;
};

