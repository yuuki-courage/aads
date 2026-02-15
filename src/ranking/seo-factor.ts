import type { SeoConfig, SeoRankingData } from "./types.js";
import type { CpcRecommendation } from "../pipeline/types.js";
import { normalizeKeyword } from "./keyword-matcher.js";

const DEFAULT_SEO_FACTORS: Record<number, number> = {
  1: 0.5,
  2: 0.6,
  3: 0.7,
  4: 0.8,
};

export const calcSeoFactor = (organicPosition: number | null, config?: Pick<SeoConfig, "seoFactors">): number => {
  if (organicPosition === null || organicPosition <= 0) return 1.0;
  const factors = config?.seoFactors ?? DEFAULT_SEO_FACTORS;

  // Exact match in the factors table
  if (organicPosition in factors) {
    return factors[organicPosition];
  }

  // Position 5-10 or beyond: no adjustment
  return 1.0;
};

export const applySeoAdjustment = (
  recommendations: CpcRecommendation[],
  rankingData: SeoRankingData,
  config: SeoConfig,
): CpcRecommendation[] => {
  return recommendations.map((rec) => {
    const normKey = normalizeKeyword(rec.keywordText);
    const rankings = rankingData.rankings.get(normKey);

    if (!rankings || rankings.length === 0) {
      return rec;
    }

    // Find the best organic position across all ASINs tracked for this keyword
    let bestOrganicPosition: number | null = null;
    for (const r of rankings) {
      if (r.organicPosition !== null) {
        if (bestOrganicPosition === null || r.organicPosition < bestOrganicPosition) {
          bestOrganicPosition = r.organicPosition;
        }
      }
    }

    const seoFactor = calcSeoFactor(bestOrganicPosition, config);

    if (seoFactor >= 1.0) {
      return {
        ...rec,
        seoFactor: 1.0,
        organicPosition: bestOrganicPosition,
      };
    }

    const adjustedBid = rec.recommendedBid * seoFactor;
    const cappedBid = config.cpcCeiling > 0 ? Math.min(adjustedBid, config.cpcCeiling) : adjustedBid;
    const finalBid = Math.max(1, Math.round(cappedBid));

    const seoReason = `seoFactor=${seoFactor.toFixed(2)} organic=#${bestOrganicPosition}`;

    return {
      ...rec,
      recommendedBid: finalBid,
      seoFactor,
      organicPosition: bestOrganicPosition,
      seoReason,
      reason: `${rec.reason} ${seoReason}`,
    };
  });
};
