import { normalizeCampaignKey } from "./normalizer.js";
import type { NormalizedRecord } from "../pipeline/types.js";

export interface IdSpineEntry {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keywordId: string;
  keywordText: string;
  matchType: string;
}

export interface IdSpine {
  byCampaignName: Map<string, IdSpineEntry>;
  byAdGroupName: Map<string, IdSpineEntry>;
  byKeyword: Map<string, IdSpineEntry>;
}

const keywordKey = (campaignName: string, adGroupName: string, keyword: string, matchType: string): string =>
  `${normalizeCampaignKey(campaignName)}|${normalizeCampaignKey(adGroupName)}|${keyword.toLowerCase().trim()}|${matchType}`;

export const buildIdSpine = (records: NormalizedRecord[]): IdSpine => {
  const byCampaignName = new Map<string, IdSpineEntry>();
  const byAdGroupName = new Map<string, IdSpineEntry>();
  const byKeyword = new Map<string, IdSpineEntry>();

  for (const r of records) {
    const entry: IdSpineEntry = {
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      adGroupId: r.adGroupId,
      adGroupName: r.adGroupName,
      keywordId: r.keywordId,
      keywordText: r.keywordText,
      matchType: r.matchType,
    };

    const cKey = normalizeCampaignKey(r.campaignName);
    if (cKey && r.campaignId) {
      byCampaignName.set(cKey, entry);
    }

    const agKey = `${cKey}|${normalizeCampaignKey(r.adGroupName)}`;
    if (r.adGroupId) {
      byAdGroupName.set(agKey, entry);
    }

    if (r.keywordText) {
      const kKey = keywordKey(r.campaignName, r.adGroupName, r.keywordText, r.matchType);
      byKeyword.set(kKey, entry);
    }
  }

  return { byCampaignName, byAdGroupName, byKeyword };
};

export const lookupCampaignId = (spine: IdSpine, campaignName: string): string => {
  const entry = spine.byCampaignName.get(normalizeCampaignKey(campaignName));
  return entry?.campaignId ?? "";
};

export const lookupAdGroupId = (spine: IdSpine, campaignName: string, adGroupName: string): string => {
  const key = `${normalizeCampaignKey(campaignName)}|${normalizeCampaignKey(adGroupName)}`;
  const entry = spine.byAdGroupName.get(key);
  return entry?.adGroupId ?? "";
};
