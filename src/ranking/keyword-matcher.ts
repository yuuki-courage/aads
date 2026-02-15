import type { KeywordMapping } from "./types.js";

// Full-width to half-width conversion table for ASCII range (U+FF01..U+FF5E -> U+0021..U+007E)
const FULLWIDTH_OFFSET = 0xff01 - 0x0021;

const toHalfWidth = (text: string): string => {
  let result = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xff01 && code <= 0xff5e) {
      result += String.fromCodePoint(code - FULLWIDTH_OFFSET);
    } else if (code === 0x3000) {
      // Ideographic space -> ASCII space
      result += " ";
    } else {
      result += ch;
    }
  }
  return result;
};

export const normalizeKeyword = (text: string): string => {
  return toHalfWidth(text).toLowerCase().replace(/\s+/g, " ").trim();
};

export interface KeywordMatchResult {
  adKeyword: string;
  rankingKeyword: string;
  normalizedKey: string;
  source: "exact" | "normalized" | "mapping";
}

export const matchKeywords = (
  adKeywords: string[],
  rankingKeywords: string[],
  mappings?: KeywordMapping[],
): KeywordMatchResult[] => {
  const results: KeywordMatchResult[] = [];
  const rankingNormMap = new Map<string, string>();
  for (const rk of rankingKeywords) {
    rankingNormMap.set(normalizeKeyword(rk), rk);
  }

  // Build manual mapping lookup (adKeyword normalized -> rankingKeyword)
  const manualMap = new Map<string, string>();
  if (mappings) {
    for (const m of mappings) {
      manualMap.set(normalizeKeyword(m.adKeyword), m.rankingKeyword);
    }
  }

  for (const adKw of adKeywords) {
    const normAd = normalizeKeyword(adKw);

    // 1. Manual mapping takes priority
    const mappedRanking = manualMap.get(normAd);
    if (mappedRanking) {
      results.push({
        adKeyword: adKw,
        rankingKeyword: mappedRanking,
        normalizedKey: normalizeKeyword(mappedRanking),
        source: "mapping",
      });
      continue;
    }

    // 2. Normalized match
    const exactRanking = rankingNormMap.get(normAd);
    if (exactRanking) {
      results.push({
        adKeyword: adKw,
        rankingKeyword: exactRanking,
        normalizedKey: normAd,
        source: "normalized",
      });
    }
  }

  return results;
};
