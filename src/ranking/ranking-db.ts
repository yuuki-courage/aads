import Database from "better-sqlite3";
import type { KeywordRankingInfo, SeoRankingData } from "./types.js";
import { normalizeKeyword } from "./keyword-matcher.js";

interface RankingHistoryRow {
  asin: string;
  keyword: string;
  timestamp: string;
  position: number;
  is_sponsored: number;
  title: string;
}

interface KeywordRow {
  keyword: string;
}

export class RankingDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true });
    this.db.pragma("journal_mode = WAL");
  }

  getOrganicPosition(keyword: string, asin: string): number | null {
    const row = this.db
      .prepare(
        `SELECT position FROM ranking_history
         WHERE keyword = ? AND asin = ? AND is_sponsored = 0
         ORDER BY timestamp DESC
         LIMIT 1`,
      )
      .get(keyword, asin) as { position: number } | undefined;

    return row?.position ?? null;
  }

  getSponsoredPosition(keyword: string, asin: string): number | null {
    const row = this.db
      .prepare(
        `SELECT position FROM ranking_history
         WHERE keyword = ? AND asin = ? AND is_sponsored = 1
         ORDER BY timestamp DESC
         LIMIT 1`,
      )
      .get(keyword, asin) as { position: number } | undefined;

    return row?.position ?? null;
  }

  getLatestRanking(keyword: string, asin: string): KeywordRankingInfo {
    const latest = this.db
      .prepare(
        `SELECT asin, keyword, timestamp, position, is_sponsored
         FROM ranking_history
         WHERE keyword = ? AND asin = ?
         ORDER BY timestamp DESC
         LIMIT 1`,
      )
      .get(keyword, asin) as RankingHistoryRow | undefined;

    if (!latest) {
      return {
        keyword,
        asin,
        organicPosition: null,
        sponsoredPosition: null,
        snapshotTimestamp: "",
        found: false,
      };
    }

    return {
      keyword,
      asin,
      organicPosition: this.getOrganicPosition(keyword, asin),
      sponsoredPosition: this.getSponsoredPosition(keyword, asin),
      snapshotTimestamp: latest.timestamp,
      found: true,
    };
  }

  getTrackedKeywords(): string[] {
    const rows = this.db.prepare("SELECT keyword FROM keywords WHERE is_active = 1").all() as KeywordRow[];

    return rows.map((r) => r.keyword);
  }

  getTrackedAsins(): string[] {
    const rows = this.db.prepare("SELECT DISTINCT asin FROM products ORDER BY asin").all() as { asin: string }[];

    return rows.map((r) => r.asin);
  }

  getLatestSnapshotDate(): string {
    const row = this.db.prepare("SELECT MAX(timestamp) as latest FROM search_result_snapshots").get() as
      | { latest: string | null }
      | undefined;

    return row?.latest ?? "";
  }

  buildSeoRankingData(adKeywords: string[], asins: string[], dbPath: string): SeoRankingData {
    const trackedKeywords = this.getTrackedKeywords();
    const snapshotDate = this.getLatestSnapshotDate();

    // Build normalized lookup: normalized -> original tracked keyword
    const trackedNormMap = new Map<string, string>();
    for (const tk of trackedKeywords) {
      trackedNormMap.set(normalizeKeyword(tk), tk);
    }

    const rankings = new Map<string, KeywordRankingInfo[]>();

    for (const adKw of adKeywords) {
      const normKey = normalizeKeyword(adKw);
      const trackedKw = trackedNormMap.get(normKey);
      if (!trackedKw) continue;

      const infos: KeywordRankingInfo[] = [];
      for (const asin of asins) {
        const info = this.getLatestRanking(trackedKw, asin);
        if (info.found) {
          infos.push(info);
        }
      }

      if (infos.length > 0) {
        rankings.set(normKey, infos);
      }
    }

    return { rankings, dbPath, snapshotDate };
  }

  close(): void {
    this.db.close();
  }
}
