import type { CpcRecommendation, NormalizedRecord, SkuClassification } from "../pipeline/types.js";
import type { SeoRankingData } from "../ranking/types.js";
import type { OptimisationConfig } from "../config/optimisation-config.js";
import { normalizeMatchType, safeDivide } from "../core/normalizer.js";
import { applySeoAdjustment } from "../ranking/seo-factor.js";

export interface CpcOptimizerOptions {
  minClicks: number;
  targetAcos: number;
  seoRankingData?: SeoRankingData;
  seoConfig?: OptimisationConfig["seo"];
}

export const generateCpcRecommendations = (
  records: NormalizedRecord[],
  skuClassifications: SkuClassification[],
  options: CpcOptimizerOptions,
): CpcRecommendation[] => {
  const skuAdjust = new Map<string, number>();
  skuClassifications.forEach((item) => skuAdjust.set(item.sku, item.bidAdjust));

  const result: CpcRecommendation[] = [];
  for (const record of records) {
    if (!record.keywordText && !record.productTargetingExpression) continue;
    if (record.clicks < options.minClicks) continue;

    const avgCpc = safeDivide(record.spend, record.clicks);
    const acos = safeDivide(record.spend, record.sales);
    const acosFactor = acos > 0 ? options.targetAcos / acos : 1;
    const skuFactor = skuAdjust.get(record.sku) ?? 1;
    const currentBid = record.bid === "" ? avgCpc : Number(record.bid);
    const recommendedBid = Math.max(1, Math.round(currentBid * acosFactor * skuFactor));

    result.push({
      campaignId: record.campaignId,
      campaignName: record.campaignName,
      adGroupId: record.adGroupId,
      adGroupName: record.adGroupName,
      keywordId: record.keywordId,
      keywordText: record.keywordText || record.productTargetingExpression,
      matchType: normalizeMatchType(record.matchType),
      sku: record.sku,
      clicks: record.clicks,
      avgCpc,
      currentBid,
      recommendedBid,
      bidAdjust: skuFactor,
      reason: `targetAcos=${options.targetAcos.toFixed(2)} skuFactor=${skuFactor.toFixed(2)}`,
    });
  }

  const sorted = result.sort((a, b) => b.clicks - a.clicks);

  // Apply SEO adjustment if ranking data is available
  if (options.seoRankingData && options.seoConfig?.enabled) {
    return applySeoAdjustment(sorted, options.seoRankingData, {
      enabled: options.seoConfig.enabled,
      seoFactors: options.seoConfig.factors,
      cpcCeiling: options.seoConfig.cpcCeiling,
    });
  }

  return sorted;
};
