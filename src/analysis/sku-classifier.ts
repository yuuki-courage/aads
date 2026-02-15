import { SKU_LABEL_RULES } from "../config/constants.js";
import type { NormalizedRecord, SkuClassification } from "../pipeline/types.js";
import { safeDivide } from "../core/normalizer.js";

interface SkuAggregate {
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
}

const classifyOne = (sku: string, agg: SkuAggregate): SkuClassification => {
  const cvr = safeDivide(agg.orders, agg.clicks);
  const acos = safeDivide(agg.spend, agg.sales);

  if (agg.clicks < 5) {
    return {
      sku,
      label: "improve",
      bidAdjust: SKU_LABEL_RULES.improve.bidAdjust,
      budgetAdjust: SKU_LABEL_RULES.improve.budgetAdjust,
      reason: "data-insufficient(clicks<5)",
    };
  }

  if (acos <= SKU_LABEL_RULES.focus.maxAcos && cvr >= SKU_LABEL_RULES.focus.minCvr) {
    return {
      sku,
      label: "focus",
      bidAdjust: SKU_LABEL_RULES.focus.bidAdjust,
      budgetAdjust: SKU_LABEL_RULES.focus.budgetAdjust,
      reason: "high-performance",
    };
  }

  if (acos <= SKU_LABEL_RULES.nurture.maxAcos && cvr >= SKU_LABEL_RULES.nurture.minCvr) {
    return {
      sku,
      label: "nurture",
      bidAdjust: SKU_LABEL_RULES.nurture.bidAdjust,
      budgetAdjust: SKU_LABEL_RULES.nurture.budgetAdjust,
      reason: "stable-growth",
    };
  }

  if (acos > SKU_LABEL_RULES.prune.minAcos || cvr < SKU_LABEL_RULES.prune.maxCvr) {
    return {
      sku,
      label: "prune",
      bidAdjust: SKU_LABEL_RULES.prune.bidAdjust,
      budgetAdjust: SKU_LABEL_RULES.prune.budgetAdjust,
      reason: "low-efficiency",
    };
  }

  return {
    sku,
    label: "improve",
    bidAdjust: SKU_LABEL_RULES.improve.bidAdjust,
    budgetAdjust: SKU_LABEL_RULES.improve.budgetAdjust,
    reason: "default",
  };
};

export const classifySkus = (records: NormalizedRecord[]): SkuClassification[] => {
  const bySku = new Map<string, SkuAggregate>();
  for (const record of records) {
    if (!record.sku) continue;
    const prev = bySku.get(record.sku) ?? { clicks: 0, spend: 0, sales: 0, orders: 0 };
    prev.clicks += record.clicks;
    prev.spend += record.spend;
    prev.sales += record.sales;
    prev.orders += record.orders;
    bySku.set(record.sku, prev);
  }

  return [...bySku.entries()].map(([sku, agg]) => classifyOne(sku, agg)).sort((a, b) => a.sku.localeCompare(b.sku));
};
