import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_VEHICLE_PLATE = "appNhapGo.lastVehiclePlate";

export function normalizeVehiclePlate(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function loadLastVehiclePlate(): Promise<string> {
  return (await AsyncStorage.getItem(LAST_VEHICLE_PLATE)) ?? "";
}

export async function rememberVehiclePlate(value: string): Promise<void> {
  await AsyncStorage.setItem(LAST_VEHICLE_PLATE, normalizeVehiclePlate(value));
}

export function formatIntakeTime(value?: string | null): string {
  if (!value) {
    return "Chưa ghi nhận";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa ghi nhận";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric"
  }).format(date);
}
