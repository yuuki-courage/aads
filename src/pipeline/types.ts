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
