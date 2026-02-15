import type { CampaignLayerId, CampaignLayerPolicy } from "../config/campaign-layer-policy.js";
import type { CampaignMetrics } from "../pipeline/types.js";

export interface CampaignLayerClassification {
  campaignName: string;
  layer: CampaignLayerId;
  confidence: "high" | "medium" | "low";
  matchedBy: "naming" | "targeting" | "fallback";
}

const DEFAULT_FALLBACK_LAYER: CampaignLayerId = "L2";

export const classifyCampaignLayers = (
  metrics: CampaignMetrics[],
  policy: CampaignLayerPolicy,
): CampaignLayerClassification[] => {
  const compiledPatterns = policy.namingPatterns.map((np) => ({
    regex: new RegExp(np.pattern),
    layer: np.layer,
  }));

  return metrics.map((campaign) => {
    // 1. Match by campaign name prefix
    for (const { regex, layer } of compiledPatterns) {
      if (regex.test(campaign.campaignName)) {
        return {
          campaignName: campaign.campaignName,
          layer,
          confidence: "high" as const,
          matchedBy: "naming" as const,
        };
      }
    }

    // 2. Fallback by targeting type
    const targetingType = campaign.targetingType.toLowerCase();
    if (targetingType === "auto" && policy.fallbackClassification.auto) {
      return {
        campaignName: campaign.campaignName,
        layer: policy.fallbackClassification.auto,
        confidence: "medium" as const,
        matchedBy: "targeting" as const,
      };
    }
    if (targetingType === "manual") {
      // Cannot determine exact/phrase/broad at campaign level, use generic manual fallback
      const fallbackKey = "manual-exact";
      if (policy.fallbackClassification[fallbackKey]) {
        return {
          campaignName: campaign.campaignName,
          layer: policy.fallbackClassification[fallbackKey],
          confidence: "medium" as const,
          matchedBy: "targeting" as const,
        };
      }
    }

    // 3. Default fallback
    return {
      campaignName: campaign.campaignName,
      layer: DEFAULT_FALLBACK_LAYER,
      confidence: "low" as const,
      matchedBy: "fallback" as const,
    };
  });
};
