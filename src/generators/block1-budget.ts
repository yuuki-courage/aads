import { buildBulkRow } from "./row-builders.js";
import type { BulkOutputRow, StrategyData, NormalizedRecord } from "../pipeline/types.js";

export const generateBudgetRows = (records: NormalizedRecord[], strategy: StrategyData): BulkOutputRow[] => {
  if (!strategy.budgetByCampaign || Object.keys(strategy.budgetByCampaign).length === 0) {
    return [];
  }

  // Collect unique campaigns with their IDs
  const campaigns = new Map<string, { campaignId: string; portfolioId: string }>();
  for (const r of records) {
    if (r.campaignName && !campaigns.has(r.campaignName)) {
      campaigns.set(r.campaignName, {
        campaignId: r.campaignId,
        portfolioId: r.portfolioId,
      });
    }
  }

  const rows: BulkOutputRow[] = [];

  for (const [campaignName, budget] of Object.entries(strategy.budgetByCampaign)) {
    const info = campaigns.get(campaignName);
    if (!info) continue;

    rows.push(
      buildBulkRow({
        Entity: "Campaign",
        Operation: "Update",
        "Campaign Name": campaignName,
        "Campaign ID": info.campaignId,
        "Portfolio ID": info.portfolioId,
        "Daily Budget": Math.round(budget),
      }),
    );
  }

  return rows;
};
