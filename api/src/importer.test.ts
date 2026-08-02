import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  parseWorkbook,
  WorkbookImportError
} from "./importer.js";

async function createPackingList(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("LS-PL NANA");
  sheet.getCell("B1").value = "PACKING LIST";
  sheet.getCell("B3").value = "No.";
  sheet.getCell("C3").value = "Cargo";
  sheet.getCell("D3").value = "Log No.";
  sheet.getCell("F3").value = "Lg (m)";
  sheet.getCell("G3").value = "Ømoy (cm)";
  sheet.getCell("H3").value = "Vol. (CBM)";
  sheet.getCell("B4").value = 1;
  sheet.getCell("C4").value = "Padouk Round logs";
  sheet.getCell("D4").value = "10224A";
  sheet.getCell("F4").value = 13.5;
  sheet.getCell("G4").value = 64;
  sheet.getCell("H4").value = 4.343;
  sheet.getCell("B5").value = 2;
  sheet.getCell("C5").value = "Padouk Round logs";
  sheet.getCell("D5").value = "1024B";
  sheet.getCell("F5").value = 9.4;
  sheet.getCell("G5").value = 62;
  sheet.getCell("H5").value = 2.838;
  sheet.getCell("B6").value = "Total/Average";
  sheet.getCell("D6").value = 2;
  sheet.getCell("H6").value = 7.181;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("parseWorkbook", () => {
  it("finds the real header and ignores the total row", async () => {
    const result = await parseWorkbook(
      await createPackingList(),
      "LN2604BNVN02 LIST PADOUK.xlsx"
    );

    assert.equal(result.listCode, "LN2604BNVN02");
    assert.equal(result.sheetName, "LS-PL NANA");
    assert.equal(result.headerRow, 3);
    assert.equal(result.totalRows, 2);
    assert.equal(result.logs.length, 2);
    assert.equal(result.logs[0].logNo, "10224A");
    assert.equal(result.logs[0].lengthM, 13.5);
    assert.equal(result.logs[0].diameterCm, 64);
    assert.equal(result.logs[0].volumeCbm, 4.343);
    assert.ok(Math.abs(result.totalVolumeCbm - 7.181) < 0.000001);
  });

  it("deduplicates Log numbers within one workbook", async () => {
    const buffer = await createPackingList();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("LS-PL NANA");
    assert.ok(sheet);
    sheet.getCell("B6").value = 3;
    sheet.getCell("C6").value = "Padouk Round logs";
    sheet.getCell("D6").value = " 10224-a ";
    sheet.getCell("H6").value = 4.343;

    const result = await parseWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
      "duplicate.xlsx"
    );

    assert.equal(result.totalRows, 3);
    assert.equal(result.logs.length, 2);
    assert.equal(result.duplicateRows, 1);
  });

  it("rejects a workbook without a Log column", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Empty").addRow(["Name", "Value"]);
    const invalidBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await assert.rejects(
      () => parseWorkbook(invalidBuffer, "invalid.xlsx"),
      WorkbookImportError
    );
  });
});
