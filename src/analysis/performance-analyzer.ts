import type { CampaignMetrics, NormalizedRecord } from "../pipeline/types.js";
import { safeDivide } from "../core/normalizer.js";

interface CampaignAccumulator {
  campaignId: string;
  campaignName: string;
  targetingType: string;
  state: string;
  clicks: number;
  impressions: number;
  spend: number;
  sales: number;
  orders: number;
  budget: number;
  budgetCount: number;
}

export const analyzePerformance = (records: NormalizedRecord[]): CampaignMetrics[] => {
  const campaigns = new Map<string, CampaignAccumulator>();

  for (const record of records) {
    const key = record.campaignId || record.campaignName;
    if (!key) continue;

    const current =
      campaigns.get(key) ??
      ({
        campaignId: record.campaignId,
        campaignName: record.campaignName,
        targetingType: record.targetingType,
        state: record.state,
        clicks: 0,
        impressions: 0,
        spend: 0,
        sales: 0,
        orders: 0,
        budget: 0,
        budgetCount: 0,
      } satisfies CampaignAccumulator);

    current.clicks += record.clicks;
    current.impressions += record.impressions;
    current.spend += record.spend;
    current.sales += record.sales;
    current.orders += record.orders;

    if (record.dailyBudget !== "") {
      current.budget += record.dailyBudget;
      current.budgetCount += 1;
    }

    campaigns.set(key, current);
  }

  return [...campaigns.values()]
    .map((item) => {
      const ctr = safeDivide(item.clicks, item.impressions);
      const cvr = safeDivide(item.orders, item.clicks);
      const acos = safeDivide(item.spend, item.sales);
      const roas = safeDivide(item.sales, item.spend);

      return {
        campaignId: item.campaignId,
        campaignName: item.campaignName,
        targetingType: item.targetingType,
        state: item.state,
        clicks: item.clicks,
        impressions: item.impressions,
        spend: item.spend,
        sales: item.sales,
        orders: item.orders,
        ctr,
        cvr,
        acos,
        roas,
        dailyBudget: item.budgetCount > 0 ? item.budget / item.budgetCount : "",
      } satisfies CampaignMetrics;
    })
    .sort((a, b) => b.sales - a.sales);
};
