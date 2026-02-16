import { buildBulkRow } from "./row-builders.js";
import { lookupCampaignId, lookupAdGroupId } from "../core/id-spine.js";
import type { IdSpine } from "../core/id-spine.js";
import type { BulkOutputRow, PromotionCandidate } from "../pipeline/types.js";

export const generatePromotionRows = (
  candidates: PromotionCandidate[],
  spine: IdSpine,
): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];

  for (const c of candidates) {
    // Derive the target manual campaign name from the recommended ad group
    // Convention: the manual campaign name is inferred from the auto campaign name
    const manualCampaignName = c.campaignName.replace(/[_\s]?auto[_\s]?/i, "_Manual_");
    const manualCampaignId = lookupCampaignId(spine, manualCampaignName);
    const manualAdGroupId = lookupAdGroupId(spine, manualCampaignName, c.recommendedAdGroupName);

    // Create keyword in manual campaign
    rows.push(
      buildBulkRow({
        Entity: "Keyword",
        Operation: "Create",
        "Campaign Name": manualCampaignName,
        "Campaign ID": manualCampaignId,
        "Ad Group Name": c.recommendedAdGroupName,
        "Ad Group ID": manualAdGroupId,
        "Keyword Text": c.keywordText,
        "Match Type": c.matchType,
        Bid: c.recommendedBid,
        State: "enabled",
      }),
    );
  }

  return rows;
};
