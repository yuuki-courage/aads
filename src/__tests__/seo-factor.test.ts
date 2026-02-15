import { describe, it, expect } from "vitest";
import { calcSeoFactor, applySeoAdjustment } from "../ranking/seo-factor.js";
import type { CpcRecommendation } from "../pipeline/types.js";
import type { SeoRankingData, KeywordRankingInfo } from "../ranking/types.js";

describe("calcSeoFactor", () => {
  it("returns 0.5 for position 1", () => {
    expect(calcSeoFactor(1)).toBe(0.5);
  });

  it("returns 0.6 for position 2", () => {
    expect(calcSeoFactor(2)).toBe(0.6);
  });

  it("returns 0.7 for position 3", () => {
    expect(calcSeoFactor(3)).toBe(0.7);
  });

  it("returns 0.8 for position 4", () => {
    expect(calcSeoFactor(4)).toBe(0.8);
  });

  it("returns 1.0 for position >= 5", () => {
    expect(calcSeoFactor(5)).toBe(1.0);
    expect(calcSeoFactor(10)).toBe(1.0);
    expect(calcSeoFactor(100)).toBe(1.0);
  });

  it("returns 1.0 for null position", () => {
    expect(calcSeoFactor(null)).toBe(1.0);
  });

  it("returns 1.0 for position 0 or negative", () => {
    expect(calcSeoFactor(0)).toBe(1.0);
    expect(calcSeoFactor(-1)).toBe(1.0);
  });

  it("uses custom factors config", () => {
    const config = { seoFactors: { 1: 0.3, 2: 0.4 } };
    expect(calcSeoFactor(1, config)).toBe(0.3);
    expect(calcSeoFactor(2, config)).toBe(0.4);
    expect(calcSeoFactor(3, config)).toBe(1.0);
  });
});

describe("applySeoAdjustment", () => {
  const makeRec = (keyword: string, bid: number): CpcRecommendation => ({
    campaignId: "C1",
    campaignName: "Campaign",
    adGroupId: "AG1",
    adGroupName: "AdGroup",
    keywordId: "K1",
    keywordText: keyword,
    matchType: "exact",
    sku: "SKU1",
    clicks: 10,
    avgCpc: 50,
    currentBid: bid,
    recommendedBid: bid,
    bidAdjust: 1.0,
    reason: "test",
  });

  const makeRankingData = (keyword: string, organicPosition: number | null): SeoRankingData => {
    const info: KeywordRankingInfo = {
      keyword,
      asin: "B0TEST",
      organicPosition,
      sponsoredPosition: null,
      snapshotTimestamp: "2026-02-15",
      found: true,
    };
    const rankings = new Map<string, KeywordRankingInfo[]>();
    rankings.set(keyword.toLowerCase(), [info]);
    return { rankings, dbPath: "test.db", snapshotDate: "2026-02-15" };
  };

  it("reduces bid for high organic position", () => {
    const recs = [makeRec("test keyword", 100)];
    const ranking = makeRankingData("test keyword", 1);
    const config = { enabled: true, seoFactors: { 1: 0.5 } as Record<number, number>, cpcCeiling: 0 };

    const result = applySeoAdjustment(recs, ranking, config);
    expect(result[0].recommendedBid).toBe(50); // 100 * 0.5
    expect(result[0].seoFactor).toBe(0.5);
    expect(result[0].organicPosition).toBe(1);
  });

  it("does not adjust for position >= 5", () => {
    const recs = [makeRec("test keyword", 100)];
    const ranking = makeRankingData("test keyword", 5);
    const config = {
      enabled: true,
      seoFactors: { 1: 0.5, 2: 0.6, 3: 0.7, 4: 0.8 } as Record<number, number>,
      cpcCeiling: 0,
    };

    const result = applySeoAdjustment(recs, ranking, config);
    expect(result[0].recommendedBid).toBe(100);
    expect(result[0].seoFactor).toBe(1.0);
  });

  it("leaves unmatched keywords unchanged", () => {
    const recs = [makeRec("unmatched keyword", 100)];
    const ranking = makeRankingData("other keyword", 1);
    const config = { enabled: true, seoFactors: { 1: 0.5 } as Record<number, number>, cpcCeiling: 0 };

    const result = applySeoAdjustment(recs, ranking, config);
    expect(result[0].recommendedBid).toBe(100);
    expect(result[0].seoFactor).toBeUndefined();
  });

  it("applies cpc ceiling", () => {
    const recs = [makeRec("test keyword", 200)];
    const ranking = makeRankingData("test keyword", 3);
    const config = { enabled: true, seoFactors: { 3: 0.7 } as Record<number, number>, cpcCeiling: 100 };

    const result = applySeoAdjustment(recs, ranking, config);
    // 200 * 0.7 = 140, but ceiling is 100
    expect(result[0].recommendedBid).toBe(100);
  });
});
