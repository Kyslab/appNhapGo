export class VehiclePlateError extends Error {}

export function parseVehiclePlate(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized.length > 30) {
    throw new VehiclePlateError("Biển số xe không được dài quá 30 ký tự.");
  }

  return normalized;
}
