import { describe, it, expect } from "vitest";
import { normalizeKeyword, matchKeywords } from "../ranking/keyword-matcher.js";

describe("normalizeKeyword", () => {
  it("converts to lowercase", () => {
    expect(normalizeKeyword("Test Keyword")).toBe("test keyword");
  });

  it("collapses whitespace", () => {
    expect(normalizeKeyword("test  keyword   here")).toBe("test keyword here");
  });

  it("trims whitespace", () => {
    expect(normalizeKeyword("  test keyword  ")).toBe("test keyword");
  });

  it("converts full-width characters to half-width", () => {
    expect(normalizeKeyword("ＡＢＣ")).toBe("abc");
    expect(normalizeKeyword("１２３")).toBe("123");
  });

  it("converts ideographic space", () => {
    expect(normalizeKeyword("test\u3000keyword")).toBe("test keyword");
  });

  it("handles Japanese text", () => {
    expect(normalizeKeyword("お風呂 洗剤")).toBe("お風呂 洗剤");
  });
});

describe("matchKeywords", () => {
  it("matches normalized keywords", () => {
    const adKeywords = ["Test Keyword", "Another One"];
    const rankingKeywords = ["test keyword", "another one", "unrelated"];

    const results = matchKeywords(adKeywords, rankingKeywords);

    expect(results).toHaveLength(2);
    expect(results[0].adKeyword).toBe("Test Keyword");
    expect(results[0].rankingKeyword).toBe("test keyword");
    expect(results[0].source).toBe("normalized");
  });

  it("returns empty for no matches", () => {
    const results = matchKeywords(["abc"], ["xyz"]);
    expect(results).toHaveLength(0);
  });

  it("prioritizes manual mapping", () => {
    const adKeywords = ["bath cleaner"];
    const rankingKeywords = ["bathroom cleaner"];
    const mappings = [{ adKeyword: "bath cleaner", rankingKeyword: "bathroom cleaner" }];

    const results = matchKeywords(adKeywords, rankingKeywords, mappings);

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("mapping");
    expect(results[0].rankingKeyword).toBe("bathroom cleaner");
  });

  it("handles full-width character matching", () => {
    const adKeywords = ["ＡＢＣ test"];
    const rankingKeywords = ["abc test"];

    const results = matchKeywords(adKeywords, rankingKeywords);

    expect(results).toHaveLength(1);
    expect(results[0].adKeyword).toBe("ＡＢＣ test");
    expect(results[0].rankingKeyword).toBe("abc test");
  });
});
