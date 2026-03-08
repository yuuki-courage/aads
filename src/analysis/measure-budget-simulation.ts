import { toChangeRate } from "./measure-effect.js";
import type {
  CampaignMetrics,
  MeasureBudgetSimulation,
  MeasureCampaignBudgetDiff,
  MeasureKpiSnapshot,
} from "../pipeline/types.js";

const toBudgetNumber = (value: number | ""): number | undefined => {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
};

const getCampaignKey = (campaign: CampaignMetrics): string => campaign.campaignId || campaign.campaignName;

export const hasBudgetData = (campaigns: CampaignMetrics[]): boolean => {
  return campaigns.some((campaign) => toBudgetNumber(campaign.dailyBudget) !== undefined);
};

export const extractTotalDailyBudget = (campaigns: CampaignMetrics[]): number => {
  return campaigns.reduce((sum, campaign) => sum + (toBudgetNumber(campaign.dailyBudget) ?? 0), 0);
};

export const buildCampaignBudgetDiffs = (
  before: CampaignMetrics[],
  after: CampaignMetrics[],
): MeasureCampaignBudgetDiff[] => {
  const beforeMap = new Map(before.map((campaign) => [getCampaignKey(campaign), campaign]));
  const afterMap = new Map(after.map((campaign) => [getCampaignKey(campaign), campaign]));
  const keys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);

  const rows: MeasureCampaignBudgetDiff[] = [];
  for (const key of keys) {
    const beforeCampaign = beforeMap.get(key);
    const afterCampaign = afterMap.get(key);
    const beforeDailyBudget = toBudgetNumber(beforeCampaign?.dailyBudget ?? "") ?? 0;
    const afterDailyBudget = toBudgetNumber(afterCampaign?.dailyBudget ?? "") ?? 0;
    rows.push({
      campaignId: afterCampaign?.campaignId || beforeCampaign?.campaignId || key,
      campaignName: afterCampaign?.campaignName || beforeCampaign?.campaignName || key,
      isNew: !beforeCampaign && !!afterCampaign,
      isRemoved: !!beforeCampaign && !afterCampaign,
      beforeDailyBudget,
      afterDailyBudget,
      budgetChangeRate: toChangeRate(beforeDailyBudget, afterDailyBudget),
    });
  }

  return rows.sort((a, b) => {
    const aDiff = Math.abs(a.afterDailyBudget - a.beforeDailyBudget);
    const bDiff = Math.abs(b.afterDailyBudget - b.beforeDailyBudget);
    return bDiff - aDiff;
  });
};

export const runBudgetSimulation = (
  beforeCampaigns: CampaignMetrics[],
  afterCampaigns: CampaignMetrics[],
  overallBefore: MeasureKpiSnapshot,
  overallAfter: MeasureKpiSnapshot,
  beforeDays: number,
  afterDays: number,
): MeasureBudgetSimulation | undefined => {
  if (!hasBudgetData(beforeCampaigns) || !hasBudgetData(afterCampaigns)) return undefined;

  const beforeTotalDailyBudget = extractTotalDailyBudget(beforeCampaigns);
  const afterTotalDailyBudget = extractTotalDailyBudget(afterCampaigns);
  const beforeRoas = Number.isFinite(overallBefore.roas) ? overallBefore.roas : 0;
  const expectedDailySales = afterTotalDailyBudget * beforeRoas;
  const actualDailySales = afterDays > 0 ? overallAfter.sales / afterDays : 0;

  return {
    available: true,
    beforeTotalDailyBudget,
    afterTotalDailyBudget,
    budgetChangeRate: toChangeRate(beforeTotalDailyBudget, afterTotalDailyBudget),
    beforeRoas,
    expectedDailySales,
    actualDailySales,
    expectedVsActualRate: toChangeRate(expectedDailySales, actualDailySales),
    beforeDays,
    afterDays,
    campaignBudgetDiffs: buildCampaignBudgetDiffs(beforeCampaigns, afterCampaigns),
  };
};
