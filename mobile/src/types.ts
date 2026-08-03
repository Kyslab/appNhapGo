export type LogStatus = "pending" | "received";
export type ShipmentType = "container" | "loose";
export type QuantityUnit = "logs" | "packages" | "boxes";

export type ImportDetailsInput = {
  shipmentType: ShipmentType;
  ownerName: string;
  contactPhone: string;
  lotName: string;
  vesselName: string;
  woodSpecies: string;
  container20Count: string;
  container40Count: string;
  containerPickupLocation: string;
  woodPickupLocation: string;
  intakeStartDate: string;
  totalQuantity: string;
  quantityUnit: QuantityUnit;
  declaredVolumeCbm: string;
};

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
  shipmentType: ShipmentType;
  ownerName: string | null;
  contactPhone: string | null;
  lotName: string | null;
  vesselName: string | null;
  woodSpecies: string | null;
  container20Count: number;
  container40Count: number;
  containerPickupLocation: string | null;
  woodPickupLocation: string | null;
  intakeStartDate: string | null;
  totalQuantity: number | null;
  quantityUnit: QuantityUnit | null;
  declaredVolumeCbm: number | null;
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

export type WoodLogPhoto = {
  id: string;
  logId: string;
  mimeType: string;
  originalFilename: string;
  byteSize: number;
  capturedAt: string;
  createdAt: string;
};

export type WarehouseSummary = {
  totalImports: number;
  totalLogs: number;
  receivedLogs: number;
  pendingLogs: number;
  photoCount: number;
};

export type WarehouseOverview = {
  summary: WarehouseSummary;
  logs: WoodLog[];
};
