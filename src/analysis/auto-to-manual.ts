import type { NegativeCandidate, NormalizedRecord, PromotionCandidate } from "../pipeline/types.js";
import { normalizeMatchType, safeDivide } from "../core/normalizer.js";

export interface AutoToManualOptions {
  minClicks: number;
  minCvr: number;
  negativeAcosThreshold: number;
}

const buildRecommendedAdGroupName = (adGroupName: string, matchType: string): string => {
  const suffix = normalizeMatchType(matchType).includes("exact") ? "manual-exact" : "manual-phrase";
  const base = adGroupName || "adgroup";
  return `${base}-${suffix}`.replace(/\s+/g, "-");
};

export const analyzeAutoToManual = (
  records: NormalizedRecord[],
  options: AutoToManualOptions,
): { promotionCandidates: PromotionCandidate[]; negativeCandidates: NegativeCandidate[] } => {
  const promotionCandidates: PromotionCandidate[] = [];
  const negativeCandidates: NegativeCandidate[] = [];

  for (const record of records) {
    const isAuto = /auto/i.test(record.targetingType || "");
    if (!isAuto) continue;

    // Auto: use customerSearchTerm (カスタマー検索用語), Manual: use keywordText (キーワードテキスト)
    const term = isAuto ? record.customerSearchTerm : record.keywordText;
    if (!term) continue;

    const cvr = safeDivide(record.orders, record.clicks);
    const acos = safeDivide(record.spend, record.sales);
    const avgCpc = safeDivide(record.spend, record.clicks);
    const recommendedBid = Math.max(1, Math.round((record.bid === "" ? avgCpc : Number(record.bid)) * 1.05));

    if (record.clicks >= options.minClicks && (record.orders > 0 || cvr >= options.minCvr)) {
      promotionCandidates.push({
        campaignId: record.campaignId,
        campaignName: record.campaignName,
        adGroupId: record.adGroupId,
        adGroupName: record.adGroupName,
        keywordText: term,
        matchType: normalizeMatchType(record.matchType || "exact"),
        sku: record.sku,
        clicks: record.clicks,
        spend: record.spend,
        orders: record.orders,
        cvr,
        avgCpc,
        recommendedBid,
        recommendedAdGroupName: buildRecommendedAdGroupName(record.adGroupName, record.matchType),
      });
    }

    if (record.clicks >= options.minClicks && record.orders === 0 && acos >= options.negativeAcosThreshold) {
      negativeCandidates.push({
        campaignId: record.campaignId,
        campaignName: record.campaignName,
        adGroupId: record.adGroupId,
        adGroupName: record.adGroupName,
        keywordText: term,
        matchType: "negative phrase",
        reason: `high_acos(${acos.toFixed(2)})`,
      });
    }
  }

  return {
    promotionCandidates: promotionCandidates.sort((a, b) => b.clicks - a.clicks),
    negativeCandidates: negativeCandidates.sort((a, b) => b.keywordText.localeCompare(a.keywordText)),
  };
};
