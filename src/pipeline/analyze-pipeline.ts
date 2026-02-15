import path from "node:path";
import { existsSync } from "node:fs";
import { createHeaderMap } from "../core/header-mapper.js";
import {
  asNumber,
  normalizeMatchType,
  normalizeState,
  normalizeText,
  safeDivide,
  toNumber,
} from "../core/normalizer.js";
import { readBulkExcelFiles } from "../io/excel-reader.js";
import { readCsvFiles } from "../io/csv-reader.js";
import { analyzePerformance } from "../analysis/performance-analyzer.js";
import { buildCampaignStructure } from "../analysis/campaign-structure.js";
import { classifySkus } from "../analysis/sku-classifier.js";
import { generateCpcRecommendations } from "../analysis/cpc-optimizer.js";
import { analyzeAutoToManual } from "../analysis/auto-to-manual.js";
import { classifyCampaignLayers } from "../analysis/campaign-layer-classifier.js";
import { loadCampaignLayerPolicy } from "../config/campaign-layer-policy.js";
import { extractDateRangeFromFiles } from "../utils/date-utils.js";
import { RankingDb } from "../ranking/ranking-db.js";
import type { SeoRankingData } from "../ranking/types.js";
import type { AnalyzePipelineResult, BulkInputData, DataRow, NormalizedRecord } from "./types.js";
import type { OptimisationConfig } from "../config/optimisation-config.js";

const readInputs = async (inputPattern: string): Promise<BulkInputData[]> => {
  const ext = path.extname(inputPattern).toLowerCase();
  if (ext === ".csv") {
    return readCsvFiles(inputPattern);
  }
  return readBulkExcelFiles(inputPattern);
};

const normalizeRecord = (row: DataRow, source: BulkInputData): NormalizedRecord => {
  const map = createHeaderMap(source.headers);
  const pick = (index: number): unknown => (index >= 0 ? row[source.headers[index]] : "");
  const asText = (index: number): string => normalizeText(pick(index));
  const asNum = (index: number): number => asNumber(pick(index), 0);
  const asNumOrEmpty = (index: number): number | "" => toNumber(pick(index));

  const clicks = asNum(map.clicks);
  const impressions = asNum(map.impressions);
  const spend = asNum(map.spend);
  const sales = asNum(map.sales);
  const orders = asNum(map.orders);

  const keywordText = asText(map.keywordText);
  const customerSearchTerm = asText(map.customerSearchTerm);

  // Infer targetingType as "auto" from product targeting expression auto subtypes
  const productTargetingExpr = asText(map.productTargetingExpression);
  const AUTO_SUBTYPES = ["close-match", "loose-match", "substitutes", "complements"];
  let targetingType = asText(map.targetingType);
  if (!targetingType && AUTO_SUBTYPES.includes(productTargetingExpr)) {
    targetingType = "auto";
  }

  return {
    campaignId: asText(map.campaignId),
    campaignName: asText(map.campaignName),
    adGroupId: asText(map.adGroupId),
    adGroupName: asText(map.adGroupName),
    keywordId: asText(map.keywordId),
    keywordText,
    customerSearchTerm,
    productTargetingExpression: productTargetingExpr,
    matchType: normalizeMatchType(asText(map.matchType)),
    targetingType,
    sku: asText(map.sku),
    asin: asText(map.asin),
    portfolioId: asText(map.portfolioId),
    state: normalizeState(asText(map.state)),
    campaignStatus: normalizeState(asText(map.state)),
    dailyBudget: asNumOrEmpty(map.dailyBudget),
    bid: asNumOrEmpty(map.bid),
    adGroupDefaultBid: asNumOrEmpty(map.adGroupDefaultBid),
    clicks,
    impressions,
    spend,
    sales,
    orders,
    ctr: safeDivide(clicks, impressions),
    cvr: safeDivide(orders, clicks),
    acos: safeDivide(spend, sales),
    roas: safeDivide(sales, spend),
    startDate: "",
    endDate: "",
    biddingStrategy: "",
    sourceFile: source.sourceFile,
  };
};

export interface AnalyzePipelineOptions {
  layerPolicyPath?: string;
  rankingDbPath?: string;
}

export const runAnalyzePipeline = async (
  inputPattern: string,
  config: OptimisationConfig,
  options?: AnalyzePipelineOptions,
): Promise<AnalyzePipelineResult> => {
  const input = await readInputs(inputPattern);
  const dateRange = extractDateRangeFromFiles(input.map((i) => i.sourceFile));
  const records = input
    .flatMap((file) => file.rows.map((row) => normalizeRecord(row, file)))
    .filter(
      (row) =>
        row.campaignId !== "" ||
        row.campaignName !== "" ||
        row.keywordText !== "" ||
        row.customerSearchTerm !== "" ||
        row.productTargetingExpression !== "" ||
        row.clicks > 0 ||
        row.impressions > 0 ||
        row.spend > 0 ||
        row.sales > 0,
    );

  // Build SEO ranking data if ranking DB is available
  let seoRankingData: SeoRankingData | undefined;
  const rankingDbPath = options?.rankingDbPath ?? process.env.RANKING_DB_PATH;
  if (rankingDbPath && config.seo.enabled && existsSync(rankingDbPath)) {
    let rankingDb: RankingDb | undefined;
    try {
      rankingDb = new RankingDb(rankingDbPath);
      const adKeywords = [...new Set(records.map((r) => r.keywordText).filter((k) => k !== ""))];
      const asins = [...new Set(records.map((r) => r.asin).filter((a) => a !== ""))];
      seoRankingData = rankingDb.buildSeoRankingData(adKeywords, asins, rankingDbPath);
    } finally {
      rankingDb?.close();
    }
  }

  const campaignMetrics = analyzePerformance(records);
  const structure = buildCampaignStructure(records);
  const skuClassification = classifySkus(records);
  const cpcRecommendations = generateCpcRecommendations(records, skuClassification, {
    minClicks: config.minClicksForCpc,
    targetAcos: config.targetAcos,
    seoRankingData,
    seoConfig: config.seo,
  });
  const { promotionCandidates, negativeCandidates } = analyzeAutoToManual(records, {
    minClicks: config.minClicksForPromotion,
    minCvr: config.minCvrForPromotion,
    negativeAcosThreshold: config.negativeAcosThreshold,
  });

  // Layer classification (optional, skipped if policy not found)
  let layerClassification: ReturnType<typeof classifyCampaignLayers> | undefined;
  try {
    const policy = await loadCampaignLayerPolicy(options?.layerPolicyPath);
    if (policy) {
      layerClassification = classifyCampaignLayers(campaignMetrics, policy);
    }
  } catch {
    // Policy file invalid or unreadable — skip layer classification silently
  }

  return {
    input,
    records,
    dateRange,
    campaignMetrics,
    structure,
    skuClassification,
    cpcRecommendations,
    promotionCandidates,
    negativeCandidates,
    layerClassification,
    seoRankingData,
  };
};
