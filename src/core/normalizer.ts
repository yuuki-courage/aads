import { STATE_MAPPING_JP_TO_EN } from "../config/constants.js";

export const normalizeCampaignKey = (name: unknown): string => {
  if (name === undefined || name === null) {
    return "";
  }
  return String(name)
    .normalize("NFKC")
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[＿_‐\-ー]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
};

export const normalizeHeaderToken = (value: unknown): string => {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\uFEFF\u200B\u00A0]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

export const toNumber = (value: unknown): number | "" => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }

  const s = String(value)
    .replace(/[\u3000\u00A0\u200B]/g, " ")
    .replace(/[^\d.,\-．]/g, "")
    .replace(/,/g, "")
    .replace(/．/g, ".")
    .trim();

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : "";
};

export const asNumber = (value: unknown, fallback = 0): number => {
  const n = toNumber(value);
  return n === "" ? fallback : n;
};

export const normalizeState = (value: unknown, fallback = "enabled"): string => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  return STATE_MAPPING_JP_TO_EN[raw] ?? raw.toLowerCase();
};

export const normalizeMatchType = (value: unknown): string => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return "exact";
  }

  if (raw === "完全一致" || raw === "exact match") return "exact";
  if (raw === "フレーズ一致" || raw === "phrase match") return "phrase";
  if (raw === "部分一致" || raw === "broad match") return "broad";
  if (raw.includes("negative") && raw.includes("exact")) return "negative exact";
  if (raw.includes("negative") && raw.includes("phrase")) return "negative phrase";
  if (raw.includes("negative") && raw.includes("broad")) return "negative broad";
  return raw;
};

export const safeDivide = (a: number, b: number): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return 0;
  }
  return a / b;
};

export const normalizeText = (value: unknown): string => String(value ?? "").trim();
