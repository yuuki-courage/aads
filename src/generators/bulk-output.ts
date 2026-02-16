import { rowIdentityKey } from "./row-builders.js";
import type { BulkOutputRow } from "../pipeline/types.js";

export const buildBulkOutput = (blockRows: BulkOutputRow[][]): BulkOutputRow[] => {
  const seen = new Set<string>();
  const result: BulkOutputRow[] = [];

  // Process blocks in order; later blocks override earlier ones for same identity
  const allRows = blockRows.flat();

  // Reverse pass: mark last occurrence of each key as the one to keep
  const lastIndex = new Map<string, number>();
  for (let i = 0; i < allRows.length; i++) {
    const key = rowIdentityKey(allRows[i]);
    lastIndex.set(key, i);
  }

  for (let i = 0; i < allRows.length; i++) {
    const key = rowIdentityKey(allRows[i]);

    // Skip if this is not the last occurrence (dedup: keep latest)
    if (lastIndex.get(key) !== i) continue;

    // Skip if we've already added this key (shouldn't happen, but guard)
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(allRows[i]);
  }

  return result;
};
