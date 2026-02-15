import { describe, it, expect } from "vitest";
import {
  toNumber,
  asNumber,
  safeDivide,
  normalizeState,
  normalizeMatchType,
  normalizeHeaderToken,
} from "../core/normalizer.js";

describe("toNumber", () => {
  it("returns number for numeric input", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(3.14)).toBe(3.14);
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(toNumber(null)).toBe("");
    expect(toNumber(undefined)).toBe("");
    expect(toNumber("")).toBe("");
  });

  it("parses numeric strings", () => {
    expect(toNumber("123")).toBe(123);
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("1,234.56")).toBe(1234.56);
  });

  it("handles full-width characters", () => {
    expect(toNumber("１２３")).toBe("");
    // Currency symbols stripped
    expect(toNumber("¥123")).toBe(123);
  });

  it("returns empty string for NaN", () => {
    expect(toNumber(NaN)).toBe("");
    expect(toNumber(Infinity)).toBe("");
    expect(toNumber("abc")).toBe("");
  });
});

describe("asNumber", () => {
  it("returns number for valid input", () => {
    expect(asNumber(42)).toBe(42);
    expect(asNumber("123")).toBe(123);
  });

  it("returns fallback for empty/null", () => {
    expect(asNumber(null, 0)).toBe(0);
    expect(asNumber("", 99)).toBe(99);
    expect(asNumber(undefined)).toBe(0);
  });
});

describe("safeDivide", () => {
  it("divides correctly", () => {
    expect(safeDivide(10, 5)).toBe(2);
    expect(safeDivide(1, 3)).toBeCloseTo(0.333, 2);
  });

  it("returns 0 for division by zero", () => {
    expect(safeDivide(10, 0)).toBe(0);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(safeDivide(NaN, 5)).toBe(0);
    expect(safeDivide(10, NaN)).toBe(0);
    expect(safeDivide(Infinity, 5)).toBe(0);
  });
});

describe("normalizeState", () => {
  it("maps Japanese state names", () => {
    expect(normalizeState("有効")).toBe("enabled");
    expect(normalizeState("一時停止")).toBe("paused");
    expect(normalizeState("非掲載")).toBe("archived");
  });

  it("passes through English state names", () => {
    expect(normalizeState("enabled")).toBe("enabled");
    expect(normalizeState("paused")).toBe("paused");
    expect(normalizeState("archived")).toBe("archived");
  });

  it("returns fallback for empty input", () => {
    expect(normalizeState("")).toBe("enabled");
    expect(normalizeState(null)).toBe("enabled");
    expect(normalizeState(undefined, "paused")).toBe("paused");
  });
});

describe("normalizeMatchType", () => {
  it("normalizes English match types", () => {
    expect(normalizeMatchType("EXACT")).toBe("exact");
    expect(normalizeMatchType("Phrase")).toBe("phrase");
    expect(normalizeMatchType("BROAD")).toBe("broad");
  });

  it("normalizes Japanese match types", () => {
    expect(normalizeMatchType("完全一致")).toBe("exact");
    expect(normalizeMatchType("フレーズ一致")).toBe("phrase");
    expect(normalizeMatchType("部分一致")).toBe("broad");
  });

  it("handles negative match types", () => {
    expect(normalizeMatchType("negative exact")).toBe("negative exact");
    expect(normalizeMatchType("negative phrase")).toBe("negative phrase");
  });

  it("returns exact for empty input", () => {
    expect(normalizeMatchType("")).toBe("exact");
    expect(normalizeMatchType(null)).toBe("exact");
  });
});

describe("normalizeHeaderToken", () => {
  it("normalizes header strings", () => {
    expect(normalizeHeaderToken("Campaign Name")).toBe("campaign name");
    expect(normalizeHeaderToken("  Clicks  ")).toBe("clicks");
  });

  it("strips BOM and zero-width chars", () => {
    expect(normalizeHeaderToken("\uFEFFClicks")).toBe("clicks");
    expect(normalizeHeaderToken("\u200BClicks")).toBe("clicks");
  });
});
