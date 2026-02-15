import type { NormalizedRecord } from "../pipeline/types.js";
import { safeDivide } from "../core/normalizer.js";

export interface AnomalyThresholds {
  impressionThreshold: number;
  spendThreshold: number;
  cpcThreshold: number;
}

export interface CampaignAnomaly {
  campaignId: string;
  campaignName: string;
  anomalyTypes: string[];
  impressionChangePct: number;
  spendChangePct: number;
  cpcChangePct: number;
}

interface Aggregate {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
}

const aggregateByCampaign = (records: NormalizedRecord[]): Map<string, Aggregate> => {
  const map = new Map<string, Aggregate>();
  for (const record of records) {
    const key = record.campaignId || record.campaignName;
    if (!key) continue;
    const agg = map.get(key) ?? {
      campaignId: record.campaignId,
      campaignName: record.campaignName,
      impressions: 0,
      clicks: 0,
      spend: 0,
    };
    agg.impressions += record.impressions;
    agg.clicks += record.clicks;
    agg.spend += record.spend;
    map.set(key, agg);
  }
  return map;
};

export const detectAnomalies = (
  current: NormalizedRecord[],
  baseline: NormalizedRecord[],
  thresholds: AnomalyThresholds,
): CampaignAnomaly[] => {
  const currentMap = aggregateByCampaign(current);
  const baselineMap = aggregateByCampaign(baseline);

  const anomalies: CampaignAnomaly[] = [];
  for (const [key, currentAgg] of currentMap.entries()) {
    const base = baselineMap.get(key);
    if (!base) continue;

    const currentCpc = safeDivide(currentAgg.spend, currentAgg.clicks);
    const baselineCpc = safeDivide(base.spend, base.clicks);
    const impressionChange = safeDivide(currentAgg.impressions - base.impressions, Math.max(base.impressions, 1));
    const spendChange = safeDivide(currentAgg.spend - base.spend, Math.max(base.spend, 1));
    const cpcChange = safeDivide(currentCpc - baselineCpc, Math.max(baselineCpc, 1e-9));

    const types: string[] = [];
    if (impressionChange > thresholds.impressionThreshold)
      types.push(`impressions+${Math.round(impressionChange * 100)}%`);
    if (spendChange > thresholds.spendThreshold) types.push(`spend+${Math.round(spendChange * 100)}%`);
    if (cpcChange > thresholds.cpcThreshold) types.push(`cpc+${Math.round(cpcChange * 100)}%`);

    if (types.length > 0) {
      anomalies.push({
        campaignId: currentAgg.campaignId,
        campaignName: currentAgg.campaignName,
        anomalyTypes: types,
        impressionChangePct: impressionChange * 100,
        spendChangePct: spendChange * 100,
        cpcChangePct: cpcChange * 100,
      });
    }
  }

  return anomalies.sort((a, b) => b.spendChangePct - a.spendChangePct);
};
