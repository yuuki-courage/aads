import { buildBulkRow } from "./row-builders.js";
import type { PlacementRecommendation } from "../analysis/placement-analyzer.js";
import type { BulkOutputRow } from "../pipeline/types.js";

export const generatePlacementRows = (recommendations: PlacementRecommendation[]): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];

  for (const rec of recommendations) {
    if (rec.recommendedPercentage <= 0) continue;

    const row = buildBulkRow({
      Entity: "Bidding Adjustment",
      Operation: "Update",
      "Campaign Name": rec.campaignName,
      "Campaign ID": rec.campaignId,
    });

    if (rec.placementType === "Top of Search") {
      row["Placement (Top of Search)"] = "enabled";
      row.Percentage = rec.recommendedPercentage;
    } else {
      row["Placement (Product Pages)"] = "enabled";
      row.Percentage = rec.recommendedPercentage;
    }

    rows.push(row);
  }

  return rows;
};
