import assert from "node:assert/strict";
import test from "node:test";
import { parseVehiclePlate, VehiclePlateError } from "./intake-details.js";

test("normalizes a vehicle plate", () => {
  assert.equal(parseVehiclePlate(" 51c  123.45 "), "51C 123.45");
});

test("keeps missing vehicle plates compatible with older app versions", () => {
  assert.equal(parseVehiclePlate(undefined), null);
  assert.equal(parseVehiclePlate("   "), null);
});

test("rejects an overly long vehicle plate", () => {
  assert.throws(() => parseVehiclePlate("A".repeat(31)), VehiclePlateError);
});
