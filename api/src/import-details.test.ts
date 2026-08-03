import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ImportDetailsError,
  parseImportDetails
} from "./import-details.js";

describe("parseImportDetails", () => {
  it("accepts a loose shipment without container fields", () => {
    const details = parseImportDetails({ shipmentType: "loose" });

    assert.equal(details.shipmentType, "loose");
    assert.equal(details.ownerName, null);
    assert.equal(details.container20Count, 0);
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
      quantityUnit: "logs"
    });

    assert.equal(details.ownerName, "Chủ hàng A");
    assert.equal(details.container20Count, 1);
    assert.equal(details.container40Count, 2);
    assert.equal(details.totalQuantity, 83);
    assert.equal(details.quantityUnit, "logs");
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
