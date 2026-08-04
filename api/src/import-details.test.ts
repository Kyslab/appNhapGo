import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ImportDetailsError,
  parseImportDetails,
  parseImportFilename
} from "./import-details.js";

describe("parseImportDetails", () => {
  it("normalizes valid loose shipment details", () => {
    const details = parseImportDetails({
      shipmentType: "loose",
      ownerName: " Chủ hàng B ",
      contactPhone: "0907654321",
      vesselName: "Tàu Đại Dương",
      woodSpecies: "Padouk",
      woodPickupLocation: "Cảng Quy Nhơn",
      intakeStartDate: "2026-08-03",
      totalQuantity: "120",
      quantityUnit: "logs",
      declaredVolumeCbm: "361,955"
    });

    assert.equal(details.shipmentType, "loose");
    assert.equal(details.ownerName, "Chủ hàng B");
    assert.equal(details.vesselName, "Tàu Đại Dương");
    assert.equal(details.woodPickupLocation, "Cảng Quy Nhơn");
    assert.equal(details.container20Count, 0);
    assert.equal(details.totalQuantity, 120);
    assert.equal(details.declaredVolumeCbm, 361.955);
  });

  it("rejects a loose shipment without a vessel name", () => {
    assert.throws(
      () =>
        parseImportDetails({
          shipmentType: "loose",
          ownerName: "Chủ hàng B",
          contactPhone: "0907654321",
          woodSpecies: "Padouk",
          woodPickupLocation: "Cảng Quy Nhơn",
          intakeStartDate: "2026-08-03",
          totalQuantity: "120",
          quantityUnit: "logs"
        }),
      ImportDetailsError
    );
  });

  it("normalizes valid container details", () => {
    const details = parseImportDetails({
      shipmentType: "container",
      ownerName: " Chủ hàng A ",
      contactPhone: "0901234567",
      lotName: "Lô Padouk 01",
      woodSpecies: "Padouk",
      container20Count: "1",
      container40Count: "2",
      containerPickupLocation: "Cảng Cát Lái",
      intakeStartDate: "2026-08-03",
      totalQuantity: "83",
      quantityUnit: "logs",
      declaredVolumeCbm: "361.955"
    });

    assert.equal(details.ownerName, "Chủ hàng A");
    assert.equal(details.container20Count, 1);
    assert.equal(details.container40Count, 2);
    assert.equal(details.totalQuantity, 83);
    assert.equal(details.quantityUnit, "logs");
    assert.equal(details.declaredVolumeCbm, 361.955);
  });

  it("rejects a non-positive declared volume", () => {
    assert.throws(
      () =>
        parseImportDetails({
          shipmentType: "loose",
          ownerName: "Chủ hàng B",
          contactPhone: "0907654321",
          vesselName: "Tàu Đại Dương",
          woodSpecies: "Padouk",
          woodPickupLocation: "Cảng Quy Nhơn",
          intakeStartDate: "2026-08-03",
          totalQuantity: "120",
          quantityUnit: "logs",
          declaredVolumeCbm: "0"
        }),
      ImportDetailsError
    );
  });

  it("rejects a container shipment without a container", () => {
    assert.throws(
      () =>
        parseImportDetails({
          shipmentType: "container",
          container20Count: "0",
          container40Count: "0"
        }),
      ImportDetailsError
    );
  });

  it("rejects an impossible intake date", () => {
    assert.throws(
      () =>
        parseImportDetails({
          shipmentType: "container",
          ownerName: "A",
          contactPhone: "1",
          lotName: "B",
          woodSpecies: "C",
          container20Count: "1",
          container40Count: "0",
          containerPickupLocation: "D",
          intakeStartDate: "2026-02-30",
          totalQuantity: "1",
          quantityUnit: "logs"
        }),
      ImportDetailsError
    );
  });
});

describe("parseImportFilename", () => {
  it("trims a valid display filename", () => {
    assert.equal(
      parseImportFilename({ originalFilename: "  lo-hang.xlsx  " }),
      "lo-hang.xlsx"
    );
  });

  it("rejects an empty display filename", () => {
    assert.throws(
      () => parseImportFilename({ originalFilename: "   " }),
      ImportDetailsError
    );
  });
});
