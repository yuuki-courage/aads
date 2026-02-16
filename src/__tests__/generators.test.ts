import { describe, it, expect } from "vitest";
import { createEmptyBulkRow, buildBulkRow, bulkRowToArray, rowIdentityKey } from "../generators/row-builders.js";
import { generateBudgetRows } from "../generators/block1-budget.js";
import { generateCpcRows } from "../generators/block2-cpc.js";
import { generatePromotionRows } from "../generators/block3-promotion.js";
import { generateNegativeSyncRows } from "../generators/block3-5-negative-sync.js";
import { generateNegativeRows } from "../generators/block4-negative.js";
import { generatePlacementRows } from "../generators/block5-placement.js";
import { buildBulkOutput } from "../generators/bulk-output.js";
import { buildIdSpine } from "../core/id-spine.js";
import { runGeneratePipeline } from "../pipeline/generate-pipeline.js";
import { BULK_SCHEMA_HEADER_V210 } from "../config/constants.js";
import type {
  NormalizedRecord,
  CpcRecommendation,
  PromotionCandidate,
  NegativeCandidate,
  AnalyzePipelineResult,
  StrategyData,
} from "../pipeline/types.js";
import type { PlacementRecommendation } from "../analysis/placement-analyzer.js";
import type { OptimisationConfig } from "../config/optimisation-config.js";

const makeRecord = (overrides: Partial<NormalizedRecord> = {}): NormalizedRecord => ({
  campaignId: "C1",
  campaignName: "Test Campaign",
  adGroupId: "AG1",
  adGroupName: "Test AdGroup",
  keywordId: "K1",
  keywordText: "test keyword",
  customerSearchTerm: "",
  productTargetingExpression: "",
  matchType: "exact",
  targetingType: "manual",
  sku: "SKU001",
  asin: "B0EXAMPLE01",
  portfolioId: "P1",
  state: "enabled",
  campaignStatus: "enabled",
  dailyBudget: 1000,
  bid: 50,
  adGroupDefaultBid: 50,
  clicks: 10,
  impressions: 1000,
  spend: 500,
  sales: 2000,
  orders: 5,
  ctr: 0.01,
  cvr: 0.5,
  acos: 0.25,
  roas: 4,
  startDate: "",
  endDate: "",
  biddingStrategy: "",
  placement: "",
  sourceFile: "test.xlsx",
  ...overrides,
});

const makeCpcRecommendation = (overrides: Partial<CpcRecommendation> = {}): CpcRecommendation => ({
  campaignId: "C1",
  campaignName: "Test Campaign",
  adGroupId: "AG1",
  adGroupName: "Test AdGroup",
  keywordId: "K1",
  keywordText: "test keyword",
  matchType: "exact",
  sku: "SKU001",
  clicks: 10,
  avgCpc: 50,
  currentBid: 50,
  recommendedBid: 45,
  bidAdjust: 1.0,
  reason: "target ACOS adjustment",
  ...overrides,
});

const makePromotionCandidate = (overrides: Partial<PromotionCandidate> = {}): PromotionCandidate => ({
  campaignId: "C1",
  campaignName: "Auto_Campaign",
  adGroupId: "AG1",
  adGroupName: "Auto AdGroup",
  keywordText: "promoted keyword",
  matchType: "exact",
  sku: "SKU001",
  clicks: 15,
  spend: 600,
  orders: 3,
  cvr: 0.2,
  avgCpc: 40,
  recommendedBid: 50,
  recommendedAdGroupName: "Manual AdGroup",
  ...overrides,
});

const makeNegativeCandidate = (overrides: Partial<NegativeCandidate> = {}): NegativeCandidate => ({
  campaignId: "C1",
  campaignName: "Test Campaign",
  adGroupId: "AG1",
  adGroupName: "Test AdGroup",
  keywordText: "bad keyword",
  matchType: "exact",
  reason: "high ACOS no sales",
  ...overrides,
});

// ── row-builders ──

describe("row-builders", () => {
  it("createEmptyBulkRow returns all 27 columns", () => {
    const row = createEmptyBulkRow();
    const keys = Object.keys(row);
    expect(keys).toHaveLength(27);
    expect(row.Product).toBe("Sponsored Products");
  });

  it("buildBulkRow merges overrides", () => {
    const row = buildBulkRow({ Entity: "Campaign", "Campaign Name": "Test" });
    expect(row.Entity).toBe("Campaign");
    expect(row["Campaign Name"]).toBe("Test");
    expect(row.Product).toBe("Sponsored Products");
  });

  it("bulkRowToArray returns array matching BULK_SCHEMA_HEADER_V210 order", () => {
    const row = buildBulkRow({ Entity: "Keyword", "Campaign Name": "C1" });
    const arr = bulkRowToArray(row);
    expect(arr).toHaveLength(BULK_SCHEMA_HEADER_V210.length);
    expect(arr[0]).toBe("Sponsored Products"); // Product
    expect(arr[1]).toBe("Keyword"); // Entity
    expect(arr[3]).toBe("C1"); // Campaign Name
  });

  it("rowIdentityKey produces stable key", () => {
    const row = buildBulkRow({
      Entity: "Keyword",
      Operation: "Update",
      "Campaign Name": "C1",
      "Keyword Text": "kw1",
      "Match Type": "exact",
    });
    const key = rowIdentityKey(row);
    expect(key).toContain("Keyword");
    expect(key).toContain("C1");
    expect(key).toContain("kw1");
  });
});

// ── Block 1: Budget ──

describe("block1-budget", () => {
  it("generates budget rows from strategy", () => {
    const records = [makeRecord({ campaignName: "Camp_A", campaignId: "C1" })];
    const strategy: StrategyData = {
      source: "none",
      budgetByCampaign: { Camp_A: 5000 },
    };

    const rows = generateBudgetRows(records, strategy);
    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Campaign");
    expect(rows[0].Operation).toBe("Update");
    expect(rows[0]["Campaign Name"]).toBe("Camp_A");
    expect(rows[0]["Daily Budget"]).toBe(5000);
  });

  it("returns empty when no budgetByCampaign", () => {
    const records = [makeRecord()];
    const strategy: StrategyData = { source: "none" };
    expect(generateBudgetRows(records, strategy)).toHaveLength(0);
  });

  it("skips campaigns not found in records", () => {
    const records = [makeRecord({ campaignName: "Camp_A" })];
    const strategy: StrategyData = {
      source: "none",
      budgetByCampaign: { Camp_B: 3000 },
    };
    expect(generateBudgetRows(records, strategy)).toHaveLength(0);
  });
});

// ── Block 2: CPC ──

describe("block2-cpc", () => {
  it("generates keyword update rows from CPC recommendations", () => {
    const recs = [makeCpcRecommendation()];
    const rows = generateCpcRows(recs);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Keyword");
    expect(rows[0].Operation).toBe("Update");
    expect(rows[0].Bid).toBe(45);
    expect(rows[0]["Keyword Text"]).toBe("test keyword");
  });

  it("handles multiple recommendations", () => {
    const recs = [
      makeCpcRecommendation({ keywordText: "kw1", recommendedBid: 30 }),
      makeCpcRecommendation({ keywordText: "kw2", recommendedBid: 60 }),
    ];
    const rows = generateCpcRows(recs);
    expect(rows).toHaveLength(2);
    expect(rows[0].Bid).toBe(30);
    expect(rows[1].Bid).toBe(60);
  });
});

// ── Block 3: Promotion ──

describe("block3-promotion", () => {
  it("generates keyword create rows for manual campaign", () => {
    const candidates = [makePromotionCandidate()];
    const records = [makeRecord()];
    const spine = buildIdSpine(records);

    const rows = generatePromotionRows(candidates, spine);
    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Keyword");
    expect(rows[0].Operation).toBe("Create");
    expect(rows[0]["Keyword Text"]).toBe("promoted keyword");
    expect(rows[0].Bid).toBe(50);
  });
});

// ── Block 3.5: Negative Sync ──

describe("block3-5-negative-sync", () => {
  it("generates negative keyword rows for promoted keywords in auto campaign", () => {
    const candidates = [makePromotionCandidate()];
    const rows = generateNegativeSyncRows(candidates);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Negative Keyword");
    expect(rows[0].Operation).toBe("Create");
    expect(rows[0]["Campaign Name"]).toBe("Auto_Campaign");
    expect(rows[0]["Keyword Text"]).toBe("promoted keyword");
    expect(rows[0]["Match Type"]).toBe("negative exact");
  });
});

// ── Block 4: Negative ──

describe("block4-negative", () => {
  it("generates negative keyword rows", () => {
    const candidates = [makeNegativeCandidate()];
    const rows = generateNegativeRows(candidates);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Negative Keyword");
    expect(rows[0].Operation).toBe("Create");
    expect(rows[0]["Keyword Text"]).toBe("bad keyword");
  });

  it("prefixes match type with negative if not already", () => {
    const candidates = [makeNegativeCandidate({ matchType: "phrase" })];
    const rows = generateNegativeRows(candidates);
    expect(rows[0]["Match Type"]).toBe("negative phrase");
  });

  it("keeps existing negative prefix", () => {
    const candidates = [makeNegativeCandidate({ matchType: "negative exact" })];
    const rows = generateNegativeRows(candidates);
    expect(rows[0]["Match Type"]).toBe("negative exact");
  });
});

// ── Block 5: Placement ──

describe("block5-placement", () => {
  it("generates placement bid modifier rows", () => {
    const recs: PlacementRecommendation[] = [
      {
        campaignId: "C1",
        campaignName: "Test Campaign",
        placementType: "Top of Search",
        currentPercentage: 0,
        recommendedPercentage: 50,
        reason: "high CVR",
      },
    ];
    const rows = generatePlacementRows(recs);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Bidding Adjustment");
    expect(rows[0]["Placement (Top of Search)"]).toBe("enabled");
    expect(rows[0].Percentage).toBe(50);
  });

  it("generates Product Pages placement rows", () => {
    const recs: PlacementRecommendation[] = [
      {
        campaignId: "C1",
        campaignName: "Test Campaign",
        placementType: "Product Pages",
        currentPercentage: 0,
        recommendedPercentage: 30,
        reason: "moderate CVR",
      },
    ];
    const rows = generatePlacementRows(recs);

    expect(rows).toHaveLength(1);
    expect(rows[0]["Placement (Product Pages)"]).toBe("enabled");
    expect(rows[0].Percentage).toBe(30);
  });

  it("skips recommendations with 0 percentage", () => {
    const recs: PlacementRecommendation[] = [
      {
        campaignId: "C1",
        campaignName: "Test Campaign",
        placementType: "Top of Search",
        currentPercentage: 0,
        recommendedPercentage: 0,
        reason: "remove modifier",
      },
    ];
    expect(generatePlacementRows(recs)).toHaveLength(0);
  });
});

// ── bulk-output (dedup) ──

describe("bulk-output", () => {
  it("deduplicates rows keeping the latest occurrence", () => {
    const row1 = buildBulkRow({
      Entity: "Keyword",
      Operation: "Update",
      "Campaign Name": "C1",
      "Keyword Text": "kw1",
      "Match Type": "exact",
      Bid: 30,
    });
    const row2 = buildBulkRow({
      Entity: "Keyword",
      Operation: "Update",
      "Campaign Name": "C1",
      "Keyword Text": "kw1",
      "Match Type": "exact",
      Bid: 45,
    });

    const result = buildBulkOutput([[row1], [row2]]);
    expect(result).toHaveLength(1);
    expect(result[0].Bid).toBe(45);
  });

  it("keeps rows with different identities", () => {
    const row1 = buildBulkRow({
      Entity: "Keyword",
      "Campaign Name": "C1",
      "Keyword Text": "kw1",
    });
    const row2 = buildBulkRow({
      Entity: "Keyword",
      "Campaign Name": "C1",
      "Keyword Text": "kw2",
    });

    const result = buildBulkOutput([[row1], [row2]]);
    expect(result).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(buildBulkOutput([])).toHaveLength(0);
    expect(buildBulkOutput([[]])).toHaveLength(0);
  });
});

// ── generate-pipeline (integration) ──

describe("generate-pipeline", () => {
  const makeAnalyzeResult = (): AnalyzePipelineResult => ({
    input: [],
    records: [makeRecord()],
    dateRange: null,
    campaignMetrics: [],
    structure: [],
    skuClassification: [],
    cpcRecommendations: [makeCpcRecommendation()],
    promotionCandidates: [makePromotionCandidate()],
    negativeCandidates: [makeNegativeCandidate()],
  });

  const makeConfig = (): OptimisationConfig => ({
    targetAcos: 0.25,
    minClicksForCpc: 5,
    minClicksForPromotion: 5,
    minCvrForPromotion: 0.03,
    negativeAcosThreshold: 0.4,
    sale: { enabled: false, cpcReductionFactor: 0.33, defaultCpc: 30 },
    b190: { impressionThreshold: 0.5, spendThreshold: 0.5, cpcThreshold: 0.3 },
    seo: { enabled: false, cpcCeiling: 0, factors: {} },
  });

  it("runs all blocks by default", () => {
    const result = runGeneratePipeline({
      analyzeResult: makeAnalyzeResult(),
      config: makeConfig(),
      strategy: { source: "none" },
      blocks: [],
    });

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.summary.totalRows).toBe(result.rows.length);
    expect(Object.keys(result.summary.blockCounts).length).toBeGreaterThan(0);
  });

  it("runs only selected blocks", () => {
    const result = runGeneratePipeline({
      analyzeResult: makeAnalyzeResult(),
      config: makeConfig(),
      strategy: { source: "none" },
      blocks: [2],
    });

    // Only block 2 (CPC) should run
    expect(result.summary.blockCounts["block2-cpc"]).toBe(1);
    expect(Object.keys(result.summary.blockCounts)).toHaveLength(1);
  });

  it("returns empty when no data matches selected blocks", () => {
    const analyzeResult = makeAnalyzeResult();
    analyzeResult.cpcRecommendations = [];
    analyzeResult.promotionCandidates = [];
    analyzeResult.negativeCandidates = [];

    const result = runGeneratePipeline({
      analyzeResult,
      config: makeConfig(),
      strategy: { source: "none" },
      blocks: [2, 4],
    });

    expect(result.summary.totalRows).toBe(0);
  });

  it("includes block 3.5 with fractional block number", () => {
    const result = runGeneratePipeline({
      analyzeResult: makeAnalyzeResult(),
      config: makeConfig(),
      strategy: { source: "none" },
      blocks: [3.5],
    });

    expect(result.summary.blockCounts["block3.5-negative-sync"]).toBeDefined();
  });
});

// ── id-spine ──

describe("id-spine", () => {
  it("builds spine and looks up campaign/ad group IDs", () => {
    const records = [
      makeRecord({ campaignId: "C1", campaignName: "Camp A", adGroupId: "AG1", adGroupName: "Group X" }),
    ];
    const spine = buildIdSpine(records);

    expect(spine.byCampaignName.size).toBe(1);
    expect(spine.byAdGroupName.size).toBe(1);
  });
});
