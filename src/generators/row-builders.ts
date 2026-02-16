import { BULK_SCHEMA_HEADER_V210 } from "../config/constants.js";
import type { BulkOutputRow } from "../pipeline/types.js";

export const createEmptyBulkRow = (): BulkOutputRow => ({
  Product: "Sponsored Products",
  Entity: "",
  Operation: "",
  "Campaign Name": "",
  "Campaign ID": "",
  "Portfolio ID": "",
  "Ad Group Name": "",
  "Ad Group ID": "",
  "Ad Group Default Bid": "",
  "SKU / ASIN": "",
  "Keyword Text": "",
  "Product Targeting Expression": "",
  "Match Type": "",
  "Campaign Targeting Type": "",
  State: "",
  "Daily Budget": "",
  Bid: "",
  "Start Date": "",
  "End Date": "",
  "Bidding Strategy": "",
  "Placement (Top of Search)": "",
  Percentage: "",
  "Placement (Product Pages)": "",
  "Targeting Type": "",
  "Keyword ID": "",
  "Product Targeting ID": "",
  "Campaign Status": "",
});

export const buildBulkRow = (overrides: Partial<BulkOutputRow>): BulkOutputRow => ({
  ...createEmptyBulkRow(),
  ...overrides,
});

export const bulkRowToArray = (row: BulkOutputRow): (string | number)[] =>
  BULK_SCHEMA_HEADER_V210.map((col) => row[col as keyof BulkOutputRow] ?? "");

export const rowIdentityKey = (row: BulkOutputRow): string => {
  const parts = [
    row.Entity,
    row.Operation,
    row["Campaign Name"],
    row["Campaign ID"],
    row["Ad Group Name"],
    row["Keyword Text"],
    row["Match Type"],
    row["Product Targeting Expression"],
  ];
  return parts.join("|");
};
