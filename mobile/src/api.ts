import { Platform } from "react-native";
import type { DocumentPickerAsset } from "expo-document-picker";
import { File, UploadType } from "expo-file-system";
import type { PhotoFile, WoodImport, WoodLog } from "./types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(API_URL + path, {
      ...init,
      headers: {
        ...apiHeaders(),
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new ApiError(
      "Không kết nối được máy chủ. Kiểm tra API URL và mạng Wi-Fi."
    );
  }

  return parseResponse<T>(await response.text(), response.ok);
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

export async function importWorkbook(asset: DocumentPickerAsset) {
  const form = new FormData();
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
  }>("/api/imports", { method: "POST", body: form });
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

export async function uploadLogPhoto(logId: string, photo: PhotoFile) {
  const file = new File(photo.uri);
  let result;

  try {
    result = await file.upload(
      API_URL + "/api/logs/" + encodeURIComponent(logId) + "/photos",
      {
        fieldName: "photo",
        headers: apiHeaders(),
        httpMethod: "POST",
        mimeType: photo.mimeType,
        parameters: { capturedAt: new Date().toISOString() },
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
    status: "received";
  }>(result.body, result.status >= 200 && result.status < 300);
}

export function photoUrl(photoId: string): string {
  return API_URL + "/api/photos/" + encodeURIComponent(photoId);
}
