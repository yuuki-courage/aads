import { buildBulkRow } from "./row-builders.js";
import type { PlacementRecommendation } from "../analysis/placement-analyzer.js";
import type { BulkOutputRow } from "../pipeline/types.js";

export const generatePlacementRows = (recommendations: PlacementRecommendation[]): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];

  for (const rec of recommendations) {
    if (rec.recommendedPercentage <= 0) continue;

    const row = buildBulkRow({
      Entity: "Campaign",
      Operation: "update",
      "Campaign Name": rec.campaignName,
      "Campaign ID": rec.campaignId,
      State: "",
    });

    if (rec.placementType === "Top of Search") {
      row["Placement (Top of Search)"] = String(rec.recommendedPercentage);
    } else {
      row["Placement (Product Pages)"] = String(rec.recommendedPercentage);
    }

    rows.push(row);
  }

  return rows;
};
