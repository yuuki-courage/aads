import { buildBulkRow } from "./row-builders.js";
import type { BulkOutputRow, PromotionCandidate } from "../pipeline/types.js";

export const generateNegativeSyncRows = (candidates: PromotionCandidate[]): BulkOutputRow[] =>
  candidates.map((c) =>
    buildBulkRow({
      Entity: "Negative Keyword",
      Operation: "Create",
      "Campaign Name": c.campaignName,
      "Campaign ID": c.campaignId,
      "Ad Group Name": c.adGroupName,
      "Ad Group ID": c.adGroupId,
      "Keyword Text": c.keywordText,
      "Match Type": "negative exact",
      State: "enabled",
    }),
  );
