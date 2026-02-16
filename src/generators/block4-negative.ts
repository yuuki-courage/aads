import { buildBulkRow } from "./row-builders.js";
import type { BulkOutputRow, NegativeCandidate } from "../pipeline/types.js";

export const generateNegativeRows = (candidates: NegativeCandidate[]): BulkOutputRow[] =>
  candidates.map((c) =>
    buildBulkRow({
      Entity: "Negative Keyword",
      Operation: "Create",
      "Campaign Name": c.campaignName,
      "Campaign ID": c.campaignId,
      "Ad Group Name": c.adGroupName,
      "Ad Group ID": c.adGroupId,
      "Keyword Text": c.keywordText,
      "Match Type": c.matchType.startsWith("negative") ? c.matchType : `negative ${c.matchType}`,
      State: "enabled",
    }),
  );
