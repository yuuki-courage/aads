# SEO Ranking Database Schema

The `--ranking-db` option accepts a SQLite database file containing Amazon search ranking data. This document describes the required schema.

## Overview

aads reads the database in **read-only mode** to look up organic/sponsored positions for ad keywords. The data is used to adjust CPC bids — keywords with strong organic rankings get lower bids (SEO factor < 1.0).

You can populate this database from any source: a custom scraper, browser extension, third-party API, or manual entry.

> **Coming soon**: We plan to release a companion Chrome extension that automatically collects Amazon search ranking data and writes to this database format.

## Tables

### ranking_history

Stores search result position snapshots over time.

```sql
CREATE TABLE ranking_history (
  asin        TEXT NOT NULL,
  keyword     TEXT NOT NULL,
  timestamp   TEXT NOT NULL,  -- ISO 8601 format (e.g. '2026-02-15T10:00:00Z')
  position    INTEGER NOT NULL,
  is_sponsored INTEGER NOT NULL DEFAULT 0,  -- 0 = organic, 1 = sponsored
  title       TEXT
);

CREATE INDEX idx_ranking_history_kw_asin
  ON ranking_history (keyword, asin, is_sponsored, timestamp DESC);
```

| Column | Type | Description |
|--------|------|-------------|
| `asin` | TEXT | Amazon product ASIN (e.g. `B0EXAMPLE01`) |
| `keyword` | TEXT | Search keyword (e.g. `bath cleaner`) |
| `timestamp` | TEXT | When the ranking was captured (ISO 8601) |
| `position` | INTEGER | Position in search results (1 = first) |
| `is_sponsored` | INTEGER | `0` for organic results, `1` for sponsored/ad placements |
| `title` | TEXT | Product title at time of snapshot (optional) |

### keywords

Tracks which keywords are being monitored.

```sql
CREATE TABLE keywords (
  keyword   TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1  -- 1 = tracked, 0 = inactive
);
```

| Column | Type | Description |
|--------|------|-------------|
| `keyword` | TEXT | Search keyword to track |
| `is_active` | INTEGER | `1` = actively tracked, `0` = paused |

### products

Tracks which ASINs to look up in ranking data.

```sql
CREATE TABLE products (
  asin TEXT PRIMARY KEY
);
```

| Column | Type | Description |
|--------|------|-------------|
| `asin` | TEXT | Amazon product ASIN |

### search_result_snapshots

Records when search result snapshots were taken.

```sql
CREATE TABLE search_result_snapshots (
  timestamp TEXT NOT NULL
);
```

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | TEXT | When the snapshot was captured (ISO 8601) |

## How aads Uses This Data

1. **Keyword matching**: Ad keywords from bulk sheets are normalized (lowercase, half-width, trimmed) and matched against `keywords.keyword`
2. **Position lookup**: For each matched keyword + ASIN pair, the latest `ranking_history` entry is retrieved
3. **SEO factor**: Organic position determines a bid multiplier:

| Organic Position | SEO Factor | Effect |
|-----------------|------------|--------|
| #1 | 0.50 | Bid reduced by 50% |
| #2 | 0.60 | Bid reduced by 40% |
| #3 | 0.70 | Bid reduced by 30% |
| #4 | 0.80 | Bid reduced by 20% |
| #5+ | 1.00 | No adjustment |

These factors are configurable via `SEO_FACTOR_POS1` through `SEO_FACTOR_POS4` environment variables.

## Sample Data

A sample database with dummy data is included at [`data/sample-ranking.db`](../data/sample-ranking.db). Use it to try out the SEO commands:

```bash
aads seo-report --input bulk-sheet.xlsx --ranking-db data/sample-ranking.db
aads cpc-report --input bulk-sheet.xlsx --output report.xlsx --ranking-db data/sample-ranking.db
```

## Creating Your Own Database

```bash
sqlite3 my-ranking.db < schema.sql
```

Or use the SQL statements above to create the tables programmatically. Then populate with your ranking data from any source.
