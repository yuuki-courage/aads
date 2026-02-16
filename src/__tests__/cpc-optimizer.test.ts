import { describe, it, expect } from "vitest";
import { generateCpcRecommendations } from "../analysis/cpc-optimizer.js";
import type { NormalizedRecord, SkuClassification } from "../pipeline/types.js";

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
  portfolioId: "",
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

describe("generateCpcRecommendations", () => {
  it("generates recommendation for keyword with sufficient clicks", () => {
    const records = [makeRecord({ clicks: 10, spend: 500, sales: 2000, bid: 50 })];
    const skus: SkuClassification[] = [
      { sku: "SKU001", label: "focus", bidAdjust: 1.2, budgetAdjust: 1.15, reason: "high-performance" },
    ];

    const result = generateCpcRecommendations(records, skus, {
      minClicks: 5,
      targetAcos: 0.25,
    });

    expect(result).toHaveLength(1);
    expect(result[0].keywordText).toBe("test keyword");
    expect(result[0].bidAdjust).toBe(1.2);
    expect(result[0].recommendedBid).toBeGreaterThan(0);
  });

  it("skips records with insufficient clicks", () => {
    const records = [makeRecord({ clicks: 2 })];
    const result = generateCpcRecommendations(records, [], {
      minClicks: 5,
      targetAcos: 0.25,
    });

    expect(result).toHaveLength(0);
  });

  it("skips records without keyword or targeting expression", () => {
    const records = [makeRecord({ keywordText: "", productTargetingExpression: "" })];
    const result = generateCpcRecommendations(records, [], {
      minClicks: 5,
      targetAcos: 0.25,
    });

    expect(result).toHaveLength(0);
  });

  it("uses avgCpc when bid is empty", () => {
    const records = [makeRecord({ clicks: 10, spend: 500, bid: "" })];
    const result = generateCpcRecommendations(records, [], {
      minClicks: 5,
      targetAcos: 0.25,
    });

    expect(result).toHaveLength(1);
    expect(result[0].currentBid).toBe(50); // 500/10 = 50
  });

  it("ensures minimum bid of 1", () => {
    const records = [makeRecord({ clicks: 100, spend: 100, sales: 100000, bid: 1 })];
    const result = generateCpcRecommendations(records, [], {
      minClicks: 5,
      targetAcos: 0.25,
    });

    expect(result).toHaveLength(1);
    expect(result[0].recommendedBid).toBeGreaterThanOrEqual(1);
  });
});
