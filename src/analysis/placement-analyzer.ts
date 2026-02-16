import { safeDivide } from "../core/normalizer.js";
import type { NormalizedRecord } from "../pipeline/types.js";

export interface PlacementRecommendation {
  campaignId: string;
  campaignName: string;
  placementType: "Top of Search" | "Product Pages";
  currentPercentage: number;
  recommendedPercentage: number;
  reason: string;
}

interface PlacementStats {
  clicks: number;
  impressions: number;
  spend: number;
  sales: number;
  orders: number;
}

const PLACEMENT_TYPES = ["Top of Search", "Product Pages", "Rest of Search"] as const;

const normalizePlacementType = (raw: string): string => {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("top") && lower.includes("search")) return "Top of Search";
  if (lower.includes("product") && lower.includes("page")) return "Product Pages";
  if (lower.includes("rest")) return "Rest of Search";
  // Japanese variants
  if (lower.includes("検索結果") && lower.includes("上部")) return "Top of Search";
  if (lower.includes("商品ページ")) return "Product Pages";
  return raw;
};

export const analyzePlacement = (
  records: NormalizedRecord[],
  targetAcos: number,
): PlacementRecommendation[] => {
  // Group records by campaign + placement
  const campaignPlacements = new Map<string, Map<string, PlacementStats>>();

  for (const r of records) {
    if (!r.campaignId || !r.placement) continue;

    const placement = normalizePlacementType(r.placement);
    if (!PLACEMENT_TYPES.includes(placement as (typeof PLACEMENT_TYPES)[number])) continue;

    if (!campaignPlacements.has(r.campaignId)) {
      campaignPlacements.set(r.campaignId, new Map());
    }
    const placements = campaignPlacements.get(r.campaignId)!;

    if (!placements.has(placement)) {
      placements.set(placement, { clicks: 0, impressions: 0, spend: 0, sales: 0, orders: 0 });
    }
    const stats = placements.get(placement)!;
    stats.clicks += r.clicks;
    stats.impressions += r.impressions;
    stats.spend += r.spend;
    stats.sales += r.sales;
    stats.orders += r.orders;
  }

  // Collect campaign names for lookback
  const campaignNames = new Map<string, string>();
  for (const r of records) {
    if (r.campaignId && r.campaignName) {
      campaignNames.set(r.campaignId, r.campaignName);
    }
  }

  const recommendations: PlacementRecommendation[] = [];

  for (const [campaignId, placements] of campaignPlacements) {
    // Get Rest of Search as baseline
    const baseline = placements.get("Rest of Search");
    if (!baseline || baseline.clicks === 0) continue;

    const baselineCvr = safeDivide(baseline.orders, baseline.clicks);

    for (const placementType of ["Top of Search", "Product Pages"] as const) {
      const stats = placements.get(placementType);
      if (!stats || stats.clicks < 5) continue;

      const cvr = safeDivide(stats.orders, stats.clicks);
      const acos = safeDivide(stats.spend, stats.sales);

      let recommendedPct = 0;
      let reason = "";

      if (cvr > baselineCvr * 1.2 && acos <= targetAcos) {
        // High CVR, good ACOS — increase bid modifier
        const cvrRatio = safeDivide(cvr, baselineCvr);
        recommendedPct = Math.min(Math.round((cvrRatio - 1) * 100), 900);
        reason = `CVR ${(cvr * 100).toFixed(1)}% > baseline ${(baselineCvr * 100).toFixed(1)}%, ACOS ${(acos * 100).toFixed(1)}% within target`;
      } else if (acos > targetAcos * 1.5) {
        // Very high ACOS — suggest reducing (0 means remove modifier)
        recommendedPct = 0;
        reason = `ACOS ${(acos * 100).toFixed(1)}% exceeds ${(targetAcos * 150).toFixed(0)}% threshold, remove modifier`;
      } else if (acos > targetAcos && acos <= targetAcos * 1.5) {
        // Moderately high ACOS — reduce modifier
        const reductionFactor = safeDivide(targetAcos, acos);
        recommendedPct = Math.max(Math.round(reductionFactor * 50), 0);
        reason = `ACOS ${(acos * 100).toFixed(1)}% above target, reduced modifier`;
      } else {
        continue;
      }

      recommendations.push({
        campaignId,
        campaignName: campaignNames.get(campaignId) ?? "",
        placementType,
        currentPercentage: 0,
        recommendedPercentage: recommendedPct,
        reason,
      });
    }
  }

  return recommendations;
};
