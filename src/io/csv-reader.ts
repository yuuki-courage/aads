import fs from "node:fs";
import type { BulkInputData, DataRow } from "../pipeline/types.js";
import { resolveInputFiles } from "./excel-reader.js";

const splitCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
};

export const readCsvFiles = (inputPattern: string): BulkInputData[] => {
  const files = resolveInputFiles(inputPattern);
  if (files.length === 0) {
    throw new Error(`No CSV files matched: ${inputPattern}`);
  }

  return files.map((file) => {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) {
      return { sourceFile: file, headers: [], rows: [] };
    }
    const headers = splitCsvLine(lines[0]).map((h) => h.trim());
    const rows: DataRow[] = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line);
      const row: DataRow = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? "";
      });
      return row;
    });
    return { sourceFile: file, headers, rows };
  });
};
