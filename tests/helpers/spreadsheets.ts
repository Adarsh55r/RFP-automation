import ExcelJS from "exceljs";

/**
 * A realistic vendor security questionnaire: an instructions sheet, then a
 * questions sheet with a title row, a header row, section headings, a formula,
 * styles and a dropdown, as buyers send them.
 */
export async function makeQuestionnaireXlsx() {
  const workbook = new ExcelJS.Workbook();
  const intro = workbook.addWorksheet("Instructions");
  intro.getCell("A1").value = "Complete every question in the Questionnaire sheet. Return by 20 November 2026.";

  const sheet = workbook.addWorksheet("Questionnaire");
  sheet.getCell("A1").value = "Vendor Security Assessment, City of Fort Hollow";
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.addRow([]);
  sheet.getRow(3).values = ["Ref", "Question", "Vendor Response", "Comments"];
  sheet.getRow(3).font = { bold: true };
  sheet.getRow(4).values = ["", "Access control"];
  sheet.getRow(5).values = ["AC-1", "Do you enforce multi-factor authentication for all administrative access?"];
  sheet.getRow(6).values = ["AC-2", "Describe how user access is reviewed and how often."];
  sheet.getRow(7).values = ["", "Data protection"];
  sheet.getRow(8).values = ["DP-1", "Is customer data encrypted at rest? State the algorithm & key length (e.g. <AES-256>)."];
  sheet.getCell("C5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  sheet.getCell("C5").dataValidation = { type: "list", allowBlank: true, formulae: ['"Yes,No,Partially"'] };
  sheet.getCell("E1").value = { formula: "COUNTA(A5:A8)", result: 3 };
  sheet.getColumn(2).width = 60;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function readBack(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  return workbook;
}
