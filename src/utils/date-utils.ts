export const formatDateYYYYMMDD = (value: Date | string | number): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export interface DateRange {
  startDate: string;
  endDate: string;
  days: number;
}

/**
 * Parse date range from Amazon bulk sheet filename.
 * Pattern: bulk-{sellerId}-{YYYYMMDD}-{YYYYMMDD}-{timestamp}.xlsx
 */
export const parseDateRangeFromFilename = (filename: string): DateRange | null => {
  const match = filename.match(/(\d{8})-(\d{8})/);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  const start = new Date(`${rawStart.slice(0, 4)}-${rawStart.slice(4, 6)}-${rawStart.slice(6, 8)}`);
  const end = new Date(`${rawEnd.slice(0, 4)}-${rawEnd.slice(4, 6)}-${rawEnd.slice(6, 8)}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return {
    startDate: formatDateYYYYMMDD(start),
    endDate: formatDateYYYYMMDD(end),
    days,
  };
};

/**
 * Extract date range from multiple input file paths. Returns the widest range found.
 */
export const extractDateRangeFromFiles = (filePaths: string[]): DateRange | null => {
  const ranges = filePaths.map(parseDateRangeFromFilename).filter((r): r is DateRange => r !== null);
  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];

  const starts = ranges.map((r) => r.startDate).sort();
  const ends = ranges.map((r) => r.endDate).sort();
  const startDate = starts[0];
  const endDate = ends[ends.length - 1];
  const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  return { startDate, endDate, days };
};

export const timestampForFilename = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
};
