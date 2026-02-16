import { buildBulkRow } from "./row-builders.js";
import type { BulkOutputRow, CpcRecommendation } from "../pipeline/types.js";

export const generateCpcRows = (recommendations: CpcRecommendation[]): BulkOutputRow[] =>
  recommendations.map((rec) =>
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
