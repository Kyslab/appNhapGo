import { Platform } from "react-native";
import type { DocumentPickerAsset } from "expo-document-picker";
import { File, UploadType } from "expo-file-system";
import type {
  ImportDetailsInput,
  ImportUpdateInput,
  IntakeDetails,
  PhotoFile,
  WarehouseOverview,
  WoodImport,
  WoodLog,
  WoodLogPhoto
} from "./types";

const emulatorUrl = Platform.OS === "android"
  ? "http://10.0.2.2:4000"
  : "http://localhost:4000";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() || emulatorUrl
).replace(/\/$/, "");

const API_KEY = process.env.EXPO_PUBLIC_API_KEY?.trim() ?? "";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiHeaders(): Record<string, string> {
  return API_KEY ? { "x-api-key": API_KEY } : {};
}

async function request<T>(
  path: string,
  init?: RequestInit,
  networkRetries = 0
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(API_URL + path, {
        ...init,
        headers: {
          ...apiHeaders(),
          ...(init?.headers ?? {})
        }
      });

      return parseResponse<T>(await response.text(), response.ok);
    } catch (caught) {
      if (caught instanceof ApiError) {
        throw caught;
      }

      if (attempt < networkRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
        continue;
      }

      throw new ApiError(
        "Máy chủ tạm thời không phản hồi. Kiểm tra kết nối Internet rồi thử lại."
      );
    }
  }
}

function parseResponse<T>(text: string, ok: boolean): T {
  let body: { message?: string } & T;

  try {
    body = text ? JSON.parse(text) : ({} as { message?: string } & T);
  } catch {
    throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ.");
  }

  if (!ok) {
    throw new ApiError(body.message || "Yêu cầu không thành công.");
  }

  return body;
}

export async function getImports(): Promise<WoodImport[]> {
  const result = await request<{ imports: WoodImport[] }>("/api/imports");
  return result.imports;
}

export async function updateImport(
  importId: string,
  details: ImportUpdateInput
) {
  return request<{ message: string; import: WoodImport }>(
    "/api/imports/" + encodeURIComponent(importId),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details)
    }
  );
}

export async function deleteImport(importId: string) {
  return request<{
    message: string;
    deletedImportId: string;
    originalFilename: string;
  }>("/api/imports/" + encodeURIComponent(importId), { method: "DELETE" });
}

export async function importWorkbook(
  asset: DocumentPickerAsset,
  details: ImportDetailsInput
) {
  const form = new FormData();
  form.append("shipmentType", details.shipmentType ?? "");
  form.append("ownerName", details.ownerName);
  form.append("contactPhone", details.contactPhone);
  form.append("woodSpecies", details.woodSpecies);
  form.append("intakeStartDate", details.intakeStartDate);
  form.append("totalQuantity", details.totalQuantity);
  form.append("quantityUnit", details.quantityUnit ?? "");
  form.append("declaredVolumeCbm", details.declaredVolumeCbm);

  if (details.shipmentType === "container") {
    form.append("lotName", details.lotName);
    form.append("container20Count", details.container20Count);
    form.append("container40Count", details.container40Count);
    form.append("containerPickupLocation", details.containerPickupLocation);
  } else if (details.shipmentType === "loose") {
    form.append("vesselName", details.vesselName);
    form.append("woodPickupLocation", details.woodPickupLocation);
  }

  form.append(
    "file",
    {
      uri: asset.uri,
      name: asset.name,
      type:
        asset.mimeType ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    } as unknown as Blob
  );

  return request<{
    duplicateFile: boolean;
    message: string;
    import: WoodImport;
  }>("/api/imports", { method: "POST", body: form }, 2);
}

export async function searchLogs(logNo: string): Promise<WoodLog[]> {
  const result = await request<{ logs: WoodLog[] }>(
    "/api/logs/search?logNo=" + encodeURIComponent(logNo)
  );
  return result.logs;
}

export async function getImportLogs(
  importId: string,
  status?: "pending" | "received"
): Promise<WoodLog[]> {
  const query = status ? "?status=" + status : "";
  const result = await request<{ logs: WoodLog[] }>(
    "/api/imports/" + encodeURIComponent(importId) + "/logs" + query
  );
  return result.logs;
}

export async function getWarehouse(): Promise<WarehouseOverview> {
  return request<WarehouseOverview>("/api/warehouse");
}

export async function getLogPhotos(logId: string): Promise<WoodLogPhoto[]> {
  const result = await request<{ photos: WoodLogPhoto[] }>(
    "/api/logs/" + encodeURIComponent(logId) + "/photos"
  );
  return result.photos;
}

async function sendPhoto(
  path: string,
  httpMethod: "POST" | "PUT",
  photo: PhotoFile,
  intake: IntakeDetails
) {
  const file = new File(photo.uri);
  let result;

  try {
    result = await file.upload(
      API_URL + path,
      {
        fieldName: "photo",
        headers: apiHeaders(),
        httpMethod,
        mimeType: photo.mimeType,
        parameters: {
          capturedAt: intake.capturedAt,
          vehiclePlate: intake.vehiclePlate
        },
        uploadType: UploadType.MULTIPART
      }
    );
  } catch (caught) {
    console.error("Photo upload failed before receiving a response", caught);
    throw new ApiError(
      "Không gửi được ảnh lên máy chủ. Kiểm tra mạng Wi-Fi rồi thử lại."
    );
  }

  return parseResponse<{
    message: string;
    photoId: string;
    photoCount: number;
    latestPhotoId?: string;
    status: "received";
    receivedAt: string;
    vehiclePlate: string | null;
  }>(result.body, result.status >= 200 && result.status < 300);
}

export async function uploadLogPhoto(
  logId: string,
  photo: PhotoFile,
  intake: IntakeDetails
) {
  return sendPhoto(
    "/api/logs/" + encodeURIComponent(logId) + "/photos",
    "POST",
    photo,
    intake
  );
}

export async function replaceLogPhoto(
  photoId: string,
  photo: PhotoFile,
  intake: IntakeDetails
) {
  return sendPhoto(
    "/api/photos/" + encodeURIComponent(photoId),
    "PUT",
    photo,
    intake
  );
}

export async function deleteLogPhoto(photoId: string) {
  return request<{
    message: string;
    deletedPhotoId: string;
    photoCount: number;
    latestPhotoId: string | null;
    status: "pending" | "received";
    receivedAt: string | null;
    vehiclePlate: string | null;
  }>("/api/photos/" + encodeURIComponent(photoId), { method: "DELETE" });
}

export function photoUrl(photoId: string): string {
  return API_URL + "/api/photos/" + encodeURIComponent(photoId);
}
