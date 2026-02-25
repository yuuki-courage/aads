import { buildBulkRow } from "./row-builders.js";
import { normalizeMatchType } from "../core/normalizer.js";
import type { ActionItem, BulkOutputRow } from "../pipeline/types.js";

const actionToRow = (action: ActionItem): BulkOutputRow => {
  switch (action.type) {
    case "negative_keyword": {
      const entity = action.adGroupId ? "Negative Keyword" : "Campaign Negative Keyword";
      return buildBulkRow({
        Entity: entity,
        Operation: "create",
        "Campaign Name": action.campaignName,
        "Campaign ID": action.campaignId,
        "Ad Group Name": action.adGroupName ?? "",
        "Ad Group ID": action.adGroupId ?? "",
        "Keyword Text": action.keywordText ?? "",
        "Match Type": action.matchType
          ? normalizeMatchType(action.matchType).startsWith("negative")
            ? normalizeMatchType(action.matchType)
            : `negative ${normalizeMatchType(action.matchType)}`
          : "negative exact",
        State: "enabled",
      });
    }

    case "negative_product_targeting": {
      return buildBulkRow({
        Entity: "Negative Product Targeting",
        Operation: "create",
        "Campaign Name": action.campaignName,
        "Campaign ID": action.campaignId,
        "Ad Group Name": action.adGroupName ?? "",
        "Ad Group ID": action.adGroupId ?? "",
        "Product Targeting Expression": action.asin ? `asin="${action.asin}"` : "",
        State: "enabled",
      });
    }

    case "keyword": {
      return buildBulkRow({
        Entity: "Keyword",
        Operation: "create",
        "Campaign Name": action.campaignName,
        "Campaign ID": action.campaignId,
        "Ad Group Name": action.adGroupName ?? "",
        "Ad Group ID": action.adGroupId ?? "",
        "Keyword Text": action.keywordText ?? "",
        "Match Type": normalizeMatchType(action.matchType),
        Bid: action.bid ?? "",
        State: "enabled",
      });
    }

    case "placement": {
      const row = buildBulkRow({
        Entity: "Campaign",
        Operation: "update",
        "Campaign Name": action.campaignName,
        "Campaign ID": action.campaignId,
        State: "",
      });

      if (action.placement === "Top of Search") {
        row["Placement (Top of Search)"] = String(action.percentage ?? 0);
      } else if (action.placement === "Product Pages") {
        row["Placement (Product Pages)"] = String(action.percentage ?? 0);
      }

      return row;
    }
  }
};

export const generateActionItemRows = (actions: ActionItem[]): BulkOutputRow[] =>
  actions.map(actionToRow);
