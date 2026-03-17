import { buildBulkRow } from "./row-builders.js";
import type { BulkOutputRow, CpcRecommendation } from "../pipeline/types.js";

export const generateCpcRows = (recommendations: CpcRecommendation[]): BulkOutputRow[] => {
  for (const rec of recommendations) {
    if (!rec.keywordId) {
      throw new Error(
        `Keyword ID is required for CPC update (SC rejects without it). ` +
          `Keyword: "${rec.keywordText}" in ${rec.campaignName}`,
      );
    }
  }
  return recommendations.map((rec) =>
    buildBulkRow({
      Entity: "Keyword",
      Operation: "Update",
      "Campaign Name": rec.campaignName,
      "Campaign ID": rec.campaignId,
      "Ad Group Name": rec.adGroupName,
      "Ad Group ID": rec.adGroupId,
      "Keyword Text": rec.keywordText,
      "Match Type": rec.matchType,
      Bid: rec.recommendedBid,
      "Keyword ID": rec.keywordId,
      State: "enabled",
    }),
  );
};
