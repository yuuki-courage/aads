import type { CampaignStructureNode, NormalizedRecord } from "../pipeline/types.js";
import { safeDivide } from "../core/normalizer.js";

interface AdGroupAccumulator {
  adGroupId: string;
  adGroupName: string;
  keywordCount: number;
  productTargetCount: number;
  spend: number;
  sales: number;
}

interface CampaignAccumulator {
  campaignId: string;
  campaignName: string;
  adGroups: Map<string, AdGroupAccumulator>;
}

export const buildCampaignStructure = (records: NormalizedRecord[]): CampaignStructureNode[] => {
  const campaigns = new Map<string, CampaignAccumulator>();

  for (const record of records) {
    const campaignKey = record.campaignId || record.campaignName;
    if (!campaignKey) continue;

    const campaign =
      campaigns.get(campaignKey) ??
      ({
        campaignId: record.campaignId,
        campaignName: record.campaignName,
        adGroups: new Map<string, AdGroupAccumulator>(),
      } satisfies CampaignAccumulator);

    const adGroupKey = record.adGroupId || record.adGroupName || "__unknown__";
    const adGroup =
      campaign.adGroups.get(adGroupKey) ??
      ({
        adGroupId: record.adGroupId,
        adGroupName: record.adGroupName,
        keywordCount: 0,
        productTargetCount: 0,
        spend: 0,
        sales: 0,
      } satisfies AdGroupAccumulator);

    if (record.keywordText) adGroup.keywordCount += 1;
    if (record.productTargetingExpression) adGroup.productTargetCount += 1;
    adGroup.spend += record.spend;
    adGroup.sales += record.sales;

    campaign.adGroups.set(adGroupKey, adGroup);
    campaigns.set(campaignKey, campaign);
  }

  return [...campaigns.values()]
    .map((campaign) => ({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      adGroups: [...campaign.adGroups.values()]
        .map((adGroup) => ({
          adGroupId: adGroup.adGroupId,
          adGroupName: adGroup.adGroupName,
          keywordCount: adGroup.keywordCount,
          productTargetCount: adGroup.productTargetCount,
          spend: adGroup.spend,
          sales: adGroup.sales,
          acos: safeDivide(adGroup.spend, adGroup.sales),
        }))
        .sort((a, b) => b.spend - a.spend),
    }))
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName));
};
