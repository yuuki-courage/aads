import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

export interface WriteSheetInput {
  name: string;
  header: string[];
  rows: Array<Array<string | number | Date>>;
}

const autoFitColumns = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.columns?.forEach((column) => {
    let maxLength = 10;
    if (!column.eachCell) {
      return;
    }
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const cellText = value === null || value === undefined ? "" : String(value);
      if (cellText.length > maxLength) {
        maxLength = Math.min(cellText.length + 2, 80);
      }
    });
    column.width = maxLength;
  });
};

export const writeXlsx = async (outputPath: string, sheets: WriteSheetInput[]): Promise<void> => {
  if (sheets.length === 0) {
    throw new Error("No sheets to write.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "aads";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRow(sheet.header);
    for (const row of sheet.rows) {
      ws.addRow(row);
    }
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: "middle", horizontal: "left" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    autoFitColumns(ws);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
};
