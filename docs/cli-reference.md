# CLI Reference

## Global Options

```
aads --version    Show version number
aads --help       Show help
```

---

## `aads analyze`

Aggregate KPIs from Amazon Ads Sponsored Products bulk sheet exports.

### Usage

```bash
aads analyze --input <pattern> [--layer-policy <file>]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--input <pattern>` | Yes | Input Excel (.xlsx) or CSV file path. Supports wildcards (e.g., `bulk-*.xlsx`) |
| `--layer-policy <file>` | No | Path to campaign layer policy JSON file |

### Output

Prints aggregated KPIs to stdout:
- Total files/rows processed
- Date range
- Number of campaigns
- Aggregate: clicks, impressions, spend, sales, orders
- Derived: CTR, CVR, ACOS, ROAS

### Example

```bash
aads analyze --input "data/input/bulk-*.xlsx"

# With layer policy
aads analyze --input report.xlsx --layer-policy data/campaign-layer-policy.json
```

---

## `aads summary`

Display campaign structure with ad group details and layer classification.

### Usage

```bash
aads summary --input <pattern> [--layer-policy <file>]
```

### Options

Same as `analyze`.

### Output

Three tables:
1. **Campaign KPI Summary** — Top 20 campaigns by sales (campaign, clicks, spend, sales, ACOS, ROAS)
2. **Structure Summary** — Top 20 campaigns (campaign, ad groups, keywords, product targets)
3. **Layer Summary** — Budget allocation by layer (L0-L4) if layer policy is provided

### Example

```bash
aads summary --input "bulk-*.xlsx" --layer-policy data/campaign-layer-policy.json
```

---

## `aads cpc-report`

Generate CPC bid optimization recommendations as an Excel report.

### Usage

```bash
aads cpc-report --input <pattern> --output <file> [--ranking-db <path>]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--input <pattern>` | Yes | Input file path or wildcard |
| `--output <file>` | Yes | Output Excel (.xlsx) file path |
| `--ranking-db <path>` | No | A_rank SQLite DB path for SEO-based CPC adjustment |

### Output Excel Columns

| Column | Description |
|--------|-------------|
| Campaign | Campaign name |
| Ad Group | Ad group name |
| Keyword | Keyword or product targeting expression |
| Clicks(14d) | Click count in the reporting period |
| AvgCPC(14d) | Average CPC |
| CurrentBid | Current bid amount |
| RecommendedBid | Recommended bid (ACOS-optimized, SKU-adjusted, SEO-adjusted) |
| BidAdjust | SKU-based bid adjustment factor |
| OrganicPos | Organic search position (if SEO data available) |
| SeoFactor | SEO adjustment factor (1.0 = no adjustment) |
| Reason | Recommendation rationale |

### Example

```bash
# Basic CPC report
aads cpc-report --input "bulk-*.xlsx" --output output/cpc.xlsx

# With SEO integration
aads cpc-report --input "bulk-*.xlsx" --output output/cpc.xlsx --ranking-db data/ranking.db
```

---

## `aads promotion-report`

Identify auto campaign search terms ready for manual promotion and suggest negative keywords.

### Usage

```bash
aads promotion-report --input <pattern> --output <file>
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--input <pattern>` | Yes | Input file path or wildcard |
| `--output <file>` | Yes | Output Excel (.xlsx) file path |

### Output

Two Excel sheets:

**Sheet 1: AutoToManual_Report**
- Auto Campaign, Ad Group, Search Term, Clicks, Spend, CVR(%), Suggested Match Type, Suggested Bid, Suggested Ad Group

**Sheet 2: Negative_Keyword_Optimisation**
- Campaign, Ad Group, Term, MatchType, Reason

### Example

```bash
aads promotion-report --input "bulk-*.xlsx" --output output/promotion.xlsx
```

---

## `aads seo-report`

Cross-reference ad keywords with organic SEO ranking data.

### Usage

```bash
aads seo-report --input <pattern> --ranking-db <path> [--output <file>] [--format <type>]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--input <pattern>` | Yes | Input file path or wildcard |
| `--ranking-db <path>` | Yes | A_rank SQLite DB path |
| `--output <file>` | No | Output file path (auto-generated if omitted for xlsx) |
| `--format <type>` | No | Output format: `console` (default), `json`, `xlsx` |

### Console Output

- DB path, snapshot date, matched keyword count
- Table of SEO-adjusted keywords with organic position and adjustment factor
- Summary counts

### JSON Output

```json
{
  "dbPath": "...",
  "snapshotDate": "...",
  "matchedKeywords": 42,
  "items": [
    {
      "campaign": "...",
      "adGroup": "...",
      "keyword": "...",
      "clicks": 100,
      "avgCpc": 50,
      "currentBid": 55,
      "recommendedBid": 28,
      "organicPos": 1,
      "seoFactor": 0.5,
      "reason": "..."
    }
  ]
}
```

### Example

```bash
# Console output
aads seo-report --input "bulk-*.xlsx" --ranking-db data/ranking.db

# JSON output
aads seo-report --input "bulk-*.xlsx" --ranking-db data/ranking.db --format json

# Excel output
aads seo-report --input "bulk-*.xlsx" --ranking-db data/ranking.db --output seo.xlsx --format xlsx
```
