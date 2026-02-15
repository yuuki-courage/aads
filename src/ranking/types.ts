export interface KeywordRankingInfo {
  keyword: string;
  asin: string;
  organicPosition: number | null; // is_sponsored=0 position
  sponsoredPosition: number | null; // is_sponsored=1 position
  snapshotTimestamp: string;
  found: boolean;
}

export interface SeoRankingData {
  rankings: Map<string, KeywordRankingInfo[]>; // key: normalized keyword
  dbPath: string;
  snapshotDate: string;
}

export interface SeoConfig {
  enabled: boolean;
  seoFactors: Record<number, number>; // position -> factor
  cpcCeiling: number;
  keywordMappingPath?: string;
  targetAsinsPath?: string;
}

export interface KeywordMapping {
  adKeyword: string;
  rankingKeyword: string;
}
