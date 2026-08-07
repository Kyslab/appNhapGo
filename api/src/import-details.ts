export type ShipmentType = "container" | "loose";
export type QuantityUnit = "logs" | "packages" | "boxes";

export type ImportDetails = {
  shipmentType: ShipmentType | null;
  ownerName: string | null;
  contactPhone: string | null;
  lotName: string | null;
  vesselName: string | null;
  woodSpecies: string | null;
  container20Count: number | null;
  container40Count: number | null;
  containerPickupLocation: string | null;
  woodPickupLocation: string | null;
  intakeStartDate: string | null;
  totalQuantity: number | null;
  quantityUnit: QuantityUnit | null;
  declaredVolumeCbm: number | null;
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

function optionalText(
  body: Record<string, unknown>,
  key: string,
  label: string,
  maxLength = 200
): string | null {
  const value = String(body[key] ?? "").trim();

  if (!value) {
    return null;
  }

  if (value.length > maxLength) {
    throw new ImportDetailsError(label + " quá dài.");
  }

  return value;
}

function optionalNonNegativeInteger(
  body: Record<string, unknown>,
  key: string,
  label: string
): number | null {
  const raw = String(body[key] ?? "").trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0) {
    throw new ImportDetailsError(label + " phải là số nguyên từ 0 trở lên.");
  }

  return value;
}

function optionalPositiveInteger(
  body: Record<string, unknown>,
  key: string,
  label: string
): number | null {
  const raw = String(body[key] ?? "").trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new ImportDetailsError(label + " phải là số nguyên lớn hơn 0.");
  }

  return value;
}

function optionalPositiveDecimal(
  body: Record<string, unknown>,
  key: string,
  label: string
): number | null {
  const raw = String(body[key] ?? "").trim().replace(",", ".");

  if (!raw) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new ImportDetailsError(label + " phải là số lớn hơn 0.");
  }

  return value;
}

function optionalValidDate(
  body: Record<string, unknown>,
  key: string
): string | null {
  const value = optionalText(body, key, "Ngày bắt đầu nhập", 10);

  if (!value) {
    return null;
  }

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
  const shipmentTypeValue = String(body.shipmentType ?? "").trim();

  if (
    shipmentTypeValue &&
    shipmentTypeValue !== "container" &&
    shipmentTypeValue !== "loose"
  ) {
    throw new ImportDetailsError(
      "Hình thức nhập hàng không hợp lệ."
    );
  }
  const shipmentType = shipmentTypeValue
    ? (shipmentTypeValue as ShipmentType)
    : null;

  const ownerName = optionalText(body, "ownerName", "Tên chủ hàng");
  const contactPhone = optionalText(
    body,
    "contactPhone",
    "Điện thoại liên hệ",
    30
  );
  const woodSpecies = optionalText(body, "woodSpecies", "Loại gỗ");
  const intakeStartDate = optionalValidDate(body, "intakeStartDate");
  const totalQuantity = optionalPositiveInteger(
    body,
    "totalQuantity",
    "Tổng số lượng"
  );
  const declaredVolumeCbm = optionalPositiveDecimal(
    body,
    "declaredVolumeCbm",
    "Tổng khối lượng CBM"
  );
  const quantityUnitValue = String(body.quantityUnit ?? "").trim();

  if (
    quantityUnitValue &&
    !new Set(["logs", "packages", "boxes"]).has(quantityUnitValue)
  ) {
    throw new ImportDetailsError("Vui lòng chọn đơn vị lóng, kiện hoặc hộp.");
  }
  const quantityUnit = quantityUnitValue
    ? (quantityUnitValue as QuantityUnit)
    : null;

  if (shipmentType === "loose") {
    return {
      shipmentType,
      ownerName,
      contactPhone,
      lotName: null,
      vesselName: optionalText(body, "vesselName", "Tên tàu"),
      woodSpecies,
      container20Count: null,
      container40Count: null,
      containerPickupLocation: null,
      woodPickupLocation: optionalText(
        body,
        "woodPickupLocation",
        "Nơi lấy gỗ"
      ),
      intakeStartDate,
      totalQuantity,
      quantityUnit,
      declaredVolumeCbm
    };
  }

  if (shipmentType === null) {
    return {
      shipmentType,
      ownerName,
      contactPhone,
      lotName: optionalText(body, "lotName", "Tên lô hàng"),
      vesselName: optionalText(body, "vesselName", "Tên tàu"),
      woodSpecies,
      container20Count: optionalNonNegativeInteger(
        body,
        "container20Count",
        "Số Cont 20'"
      ),
      container40Count: optionalNonNegativeInteger(
        body,
        "container40Count",
        "Số Cont 40'"
      ),
      containerPickupLocation: optionalText(
        body,
        "containerPickupLocation",
        "Nơi lấy container"
      ),
      woodPickupLocation: optionalText(
        body,
        "woodPickupLocation",
        "Nơi lấy gỗ"
      ),
      intakeStartDate,
      totalQuantity,
      quantityUnit,
      declaredVolumeCbm
    };
  }

  const container20Count = optionalNonNegativeInteger(
    body,
    "container20Count",
    "Số Cont 20'"
  );
  const container40Count = optionalNonNegativeInteger(
    body,
    "container40Count",
    "Số Cont 40'"
  );

  return {
    shipmentType,
    ownerName,
    contactPhone,
    lotName: optionalText(body, "lotName", "Tên lô hàng"),
    vesselName: null,
    woodSpecies,
    container20Count,
    container40Count,
    containerPickupLocation: optionalText(
      body,
      "containerPickupLocation",
      "Nơi lấy container"
    ),
    woodPickupLocation: null,
    intakeStartDate,
    totalQuantity,
    quantityUnit,
    declaredVolumeCbm
  };
}

export function parseImportFilename(value: unknown): string {
  return requiredText(bodyRecord(value), "originalFilename", "tên file", 255);
}
