export type ShipmentType = "container" | "loose";
export type QuantityUnit = "logs" | "packages" | "boxes";

export type ImportDetails = {
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
};

export class ImportDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportDetailsError";
  }
}

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function requiredText(
  body: Record<string, unknown>,
  key: string,
  label: string,
  maxLength = 200
): string {
  const value = String(body[key] ?? "").trim();

  if (!value) {
    throw new ImportDetailsError("Vui lòng nhập " + label + ".");
  }

  if (value.length > maxLength) {
    throw new ImportDetailsError(label + " quá dài.");
  }

  return value;
}

function nonNegativeInteger(
  body: Record<string, unknown>,
  key: string,
  label: string
): number {
  const raw = String(body[key] ?? "").trim();
  const value = Number(raw || "0");

  if (!Number.isInteger(value) || value < 0) {
    throw new ImportDetailsError(label + " phải là số nguyên từ 0 trở lên.");
  }

  return value;
}

function positiveInteger(
  body: Record<string, unknown>,
  key: string,
  label: string
): number {
  const value = Number(String(body[key] ?? "").trim());

  if (!Number.isInteger(value) || value <= 0) {
    throw new ImportDetailsError(label + " phải là số nguyên lớn hơn 0.");
  }

  return value;
}

function validDate(body: Record<string, unknown>, key: string): string {
  const value = requiredText(body, key, "ngày bắt đầu nhập", 10);
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!parts) {
    throw new ImportDetailsError("Ngày bắt đầu nhập phải có dạng YYYY-MM-DD.");
  }

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ImportDetailsError("Ngày bắt đầu nhập không hợp lệ.");
  }

  return value;
}

export function parseImportDetails(value: unknown): ImportDetails {
  const body = bodyRecord(value);
  const shipmentType = String(body.shipmentType ?? "").trim();

  if (shipmentType !== "container" && shipmentType !== "loose") {
    throw new ImportDetailsError(
      "Vui lòng chọn nhập hàng Container hoặc nhập hàng rời."
    );
  }

  const ownerName = requiredText(body, "ownerName", "tên chủ hàng");
  const contactPhone = requiredText(
    body,
    "contactPhone",
    "điện thoại liên hệ",
    30
  );
  const woodSpecies = requiredText(body, "woodSpecies", "loại gỗ");
  const intakeStartDate = validDate(body, "intakeStartDate");
  const totalQuantity = positiveInteger(
    body,
    "totalQuantity",
    "Tổng số lượng"
  );
  const quantityUnit = String(body.quantityUnit ?? "").trim();

  if (!new Set(["logs", "packages", "boxes"]).has(quantityUnit)) {
    throw new ImportDetailsError("Vui lòng chọn đơn vị lóng, kiện hoặc hộp.");
  }

  if (shipmentType === "loose") {
    return {
      shipmentType,
      ownerName,
      contactPhone,
      lotName: null,
      vesselName: requiredText(body, "vesselName", "tên tàu"),
      woodSpecies,
      container20Count: 0,
      container40Count: 0,
      containerPickupLocation: null,
      woodPickupLocation: requiredText(
        body,
        "woodPickupLocation",
        "nơi lấy gỗ"
      ),
      intakeStartDate,
      totalQuantity,
      quantityUnit: quantityUnit as QuantityUnit
    };
  }

  const container20Count = nonNegativeInteger(
    body,
    "container20Count",
    "Số Cont 20'"
  );
  const container40Count = nonNegativeInteger(
    body,
    "container40Count",
    "Số Cont 40'"
  );

  if (container20Count + container40Count === 0) {
    throw new ImportDetailsError("Lô hàng phải có ít nhất 1 container.");
  }

  return {
    shipmentType,
    ownerName,
    contactPhone,
    lotName: requiredText(body, "lotName", "tên lô hàng"),
    vesselName: null,
    woodSpecies,
    container20Count,
    container40Count,
    containerPickupLocation: requiredText(
      body,
      "containerPickupLocation",
      "nơi lấy container"
    ),
    woodPickupLocation: null,
    intakeStartDate,
    totalQuantity,
    quantityUnit: quantityUnit as QuantityUnit
  };
}
