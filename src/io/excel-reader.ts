import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import type { BulkInputData, DataRow, RowValue } from "../pipeline/types.js";

const SEARCH_TERM_REPORT_SHEETS = ["SP検索ワードレポート", "SB検索ワードレポート"];

export interface ReadBulkOptions {
  sheetsFilter?: "search-term-only" | "all";
}

const wildcardToRegExp = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${regex}$`, "i");
};

export const resolveInputFiles = (inputPattern: string): string[] => {
  const normalized = inputPattern.replace(/\\/g, "/");
  const hasWildcard = /[*?]/.test(normalized);
  if (!hasWildcard) {
    return [inputPattern];
  }

  const parsed = path.parse(normalized);
  const dir = parsed.dir || ".";
  const filePattern = parsed.base;
  const regex = wildcardToRegExp(filePattern);

  if (!fs.existsSync(dir)) {
    throw new Error(`Input directory not found: ${dir}`);
  }

  return fs
    .readdirSync(dir)
    .filter((name) => regex.test(name))
    .map((name) => path.join(dir, name))
    .sort((a, b) => a.localeCompare(b));
};

const normalizeCell = (value: ExcelJS.CellValue): RowValue => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "result" in value) return (value.result as RowValue) ?? "";
  return String(value);
};

const readWorksheetAsRows = (worksheet: ExcelJS.Worksheet): { headers: string[]; rows: DataRow[] } => {
  const rows: RowValue[][] = [];
  worksheet.eachRow((row) => {
    const values = row.values as Array<RowValue | undefined>;
    rows.push(values.slice(1).map((value) => (value === undefined ? "" : value)));
  });

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((h) => String(h ?? "").trim());
  const dataRows: DataRow[] = rows.slice(1).map((cells) => {
    const item: DataRow = {};
    for (let i = 0; i < headers.length; i += 1) {
      item[headers[i]] = normalizeCell(cells[i] as ExcelJS.CellValue);
    }
    return item;
  });

  return { headers, rows: dataRows };
};

export const readBulkExcelFiles = async (
  inputPattern: string,
  options: ReadBulkOptions = {},
): Promise<BulkInputData[]> => {
  const { sheetsFilter = "search-term-only" } = options;
  const files = resolveInputFiles(inputPattern);
  if (files.length === 0) {
    throw new Error(`No input files matched: ${inputPattern}`);
  }

  const results: BulkInputData[] = [];

  for (const file of files) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);

    for (const worksheet of workbook.worksheets) {
      if (sheetsFilter === "search-term-only" && !SEARCH_TERM_REPORT_SHEETS.includes(worksheet.name)) {
        continue;
      }
      const parsed = readWorksheetAsRows(worksheet);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        continue;
      }
      results.push({
        sourceFile: `${file}#${worksheet.name}`,
        headers: parsed.headers,
        rows: parsed.rows,
      });
    }
  }

  return results;
};
