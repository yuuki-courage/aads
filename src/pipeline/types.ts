import type { CampaignLayerClassification } from "../analysis/campaign-layer-classifier.js";
import type { OptimisationConfig } from "../config/optimisation-config.js";
import type { SeoRankingData } from "../ranking/types.js";

export type RowValue = string | number | boolean | Date | null | undefined;
export type DataRow = Record<string, RowValue>;

export type OutputFormat = "console" | "json" | "markdown" | "xlsx";

export interface BulkInputData {
  sourceFile: string;
  headers: string[];
  rows: DataRow[];
}

export interface NormalizedRecord {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keywordId: string;
  keywordText: string;
  customerSearchTerm: string;
  productTargetingExpression: string;
  matchType: string;
  targetingType: string;
  sku: string;
  asin: string;
  portfolioId: string;
  state: string;
  campaignStatus: string;
  dailyBudget: number | "";
  bid: number | "";
  adGroupDefaultBid: number | "";
  clicks: number;
  impressions: number;
  spend: number;
  sales: number;
  orders: number;
  ctr: number;
  cvr: number;
  acos: number;
  roas: number;
  startDate: string;
  endDate: string;
  biddingStrategy: string;
  placement: string;
  sourceFile: string;
}

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  targetingType: string;
  state: string;
  clicks: number;
  impressions: number;
  spend: number;
  sales: number;
  orders: number;
  ctr: number;
  cvr: number;
  acos: number;
  roas: number;
  dailyBudget: number | "";
}

export interface CampaignStructureNode {
  campaignId: string;
  campaignName: string;
  adGroups: Array<{
    adGroupId: string;
    adGroupName: string;
    keywordCount: number;
    productTargetCount: number;
    spend: number;
    sales: number;
    acos: number;
  }>;
}

export type SkuLabel = "focus" | "nurture" | "improve" | "prune";

export interface SkuClassification {
  sku: string;
  label: SkuLabel;
  bidAdjust: number;
  budgetAdjust: number;
  reason: string;
}

export interface CpcRecommendation {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keywordId: string;
  keywordText: string;
  matchType: string;
  sku: string;
  clicks: number;
  avgCpc: number;
  currentBid: number;
  recommendedBid: number;
  bidAdjust: number;
  reason: string;
  seoFactor?: number;
  organicPosition?: number | null;
  seoReason?: string;
}

export interface PromotionCandidate {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keywordText: string;
  matchType: string;
  sku: string;
  clicks: number;
  spend: number;
  orders: number;
  cvr: number;
  avgCpc: number;
  recommendedBid: number;
  recommendedAdGroupName: string;
}

export interface NegativeCandidate {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  keywordText: string;
  matchType: string;
  reason: string;
}

export interface AnalyzePipelineResult {
  input: BulkInputData[];
  records: NormalizedRecord[];
  dateRange: { startDate: string; endDate: string; days: number } | null;
  campaignMetrics: CampaignMetrics[];
  structure: CampaignStructureNode[];
  skuClassification: SkuClassification[];
  cpcRecommendations: CpcRecommendation[];
  promotionCandidates: PromotionCandidate[];
  negativeCandidates: NegativeCandidate[];
  layerClassification?: CampaignLayerClassification[];
  seoRankingData?: SeoRankingData;
}

export interface BulkOutputRow {
  Product: string;
  Entity: string;
  Operation: string;
  "Campaign Name": string;
  "Campaign ID": string;
  "Portfolio ID": string;
  "Ad Group Name": string;
  "Ad Group ID": string;
  "Ad Group Default Bid": string | number;
  "SKU / ASIN": string;
  "Keyword Text": string;
  "Product Targeting Expression": string;
  "Match Type": string;
  "Campaign Targeting Type": string;
  State: string;
  "Daily Budget": string | number;
  Bid: string | number;
  "Start Date": string;
  "End Date": string;
  "Bidding Strategy": string;
  "Placement (Top of Search)": string;
  Percentage: string | number;
  "Placement (Product Pages)": string;
  "Targeting Type": string;
  "Keyword ID": string;
  "Product Targeting ID": string;
  "Campaign Status": string;
}

export type ActionItemType = "negative_keyword" | "negative_product_targeting" | "keyword" | "placement";

export interface ActionItem {
  type: ActionItemType;
  campaignId: string;
  campaignName: string;
  adGroupId?: string;
  adGroupName?: string;
  keywordText?: string;
  matchType?: string;
  bid?: number;
  asin?: string;
  placement?: "Top of Search" | "Product Pages";
  percentage?: number;
}

export interface ActionItemsConfig {
  description?: string;
  actions: ActionItem[];
}

// === measure types ===

export type MeasureKpiKey =
  | "impressions"
  | "clicks"
  | "spend"
  | "sales"
  | "orders"
  | "ctr"
  | "cvr"
  | "acos"
  | "roas"
  | "cpc"
  | "cpa";

export type MeasureCriterionDirection = "increase" | "decrease" | "non-increase" | "non-decrease";
export type MeasureVerdict = "improved" | "neutral" | "degraded";
export type MeasureLogStatus = "pending" | "monitoring" | "completed" | "archived";

export interface MeasureCriterion {
  kpi: MeasureKpiKey;
  direction: MeasureCriterionDirection;
  threshold: number;
  label: string;
}

export interface MeasurePattern {
  id: string;
  name: string;
  description: string;
  focusKpis: MeasureKpiKey[];
  recommendedWindowDays: number;
  criteria: MeasureCriterion[];
  requiresLlm?: boolean;
}

export interface MeasureKpiSnapshot {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  ctr: number;
  cvr: number;
  acos: number;
  roas: number;
  cpc: number;
  cpa: number;
  campaignCount: number;
}

export interface MeasureKpiDiff {
  kpi: MeasureKpiKey;
  before: number;
  after: number;
  diff: number;
  changeRate: number;
}

export interface MeasureCriteriaEvaluation {
  criterion: MeasureCriterion;
  before: number;
  after: number;
  changeRate: number;
  passed: boolean;
}

export interface MeasureCampaignDiff {
  campaignId: string;
  campaignName: string;
  isNew: boolean;
  isRemoved: boolean;
  before: MeasureKpiSnapshot;
  after: MeasureKpiSnapshot;
  focusDiffs: MeasureKpiDiff[];
}

export interface MeasureCampaignBudgetDiff {
  campaignId: string;
  campaignName: string;
  isNew: boolean;
  isRemoved: boolean;
  beforeDailyBudget: number;
  afterDailyBudget: number;
  budgetChangeRate: number;
}

export interface MeasureBudgetSimulation {
  available: boolean;
  beforeTotalDailyBudget: number;
  afterTotalDailyBudget: number;
  budgetChangeRate: number;
  beforeRoas: number;
  expectedDailySales: number;
  actualDailySales: number;
  expectedVsActualRate: number;
  beforeDays: number;
  afterDays: number;
  campaignBudgetDiffs: MeasureCampaignBudgetDiff[];
}

export type HypothesisConfidence = "high" | "medium" | "low";

export interface MeasureHypothesis {
  id: string;
  pattern: string;
  hypothesis: string;
  confidence: HypothesisConfidence;
  suggestedAction: string;
  suggestedMetrics: string[];
}

export interface MeasureCompareResult {
  generatedAt: string;
  patternId: string;
  patternName: string;
  logId?: string;
  measureName?: string;
  measureDescription?: string;
  focusKpis: MeasureKpiKey[];
  verdict: MeasureVerdict;
  beforeInput: string;
  afterInput: string;
  beforeDateRange: { startDate: string; endDate: string; days: number } | null;
  afterDateRange: { startDate: string; endDate: string; days: number } | null;
  filters: {
    campaigns: string[];
    asins: string[];
  };
  overallBefore: MeasureKpiSnapshot;
  overallAfter: MeasureKpiSnapshot;
  overallDiffs: MeasureKpiDiff[];
  focusDiffs: MeasureKpiDiff[];
  criteriaEvaluations: MeasureCriteriaEvaluation[];
  campaignDiffs: MeasureCampaignDiff[];
  budgetSimulation?: MeasureBudgetSimulation;
  hypotheses?: MeasureHypothesis[];
  llmAnalysis?: string;
}

export interface MeasureLogNote {
  text: string;
  createdAt: string;
}

export interface MeasureLogEntry {
  id: string;
  patternId: string;
  name: string;
  date: string;
  description?: string;
  status: MeasureLogStatus;
  createdAt: string;
  updatedAt: string;
  actionConfigPath?: string;
  lastCompare?: MeasureCompareResult;
  notes?: MeasureLogNote[];
}

export interface StrategyData {
  source: "none";
  targetAcos?: number;
  totalDailyBudget?: number;
  budgetByCampaign?: Record<string, number>;
}

export interface GeneratePipelineInput {
  analyzeResult: AnalyzePipelineResult;
  config: OptimisationConfig;
  strategy: StrategyData;
  blocks: number[];
}

export interface GeneratePipelineResult {
  rows: BulkOutputRow[];
  summary: {
    blockCounts: Record<string, number>;
    totalRows: number;
  };
}
