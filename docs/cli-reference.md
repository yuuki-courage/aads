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

---

## `aads generate`

Generate Amazon Ads bulk sheets from analysis results.

### Usage

```bash
aads generate --input <pattern> --output <file> [--blocks <list>]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--input <pattern>` | Yes | Input file path or wildcard |
| `--output <file>` | Yes | Output Excel (.xlsx) file path |
| `--blocks <list>` | No | Block numbers to execute (comma-separated: 1,2,3,3.5,4,5) |

### Blocks

| Block | Description |
|-------|-------------|
| 1 | Budget update |
| 2 | CPC bid update |
| 3 | Auto→Manual keyword promotion |
| 3.5 | Negative keyword sync for promoted keywords |
| 4 | Negative keyword creation |
| 5 | Placement bid adjustment |

### Example

```bash
# Run all blocks
aads generate --input "bulk-*.xlsx" --output output/bulk.xlsx

# Run specific blocks only
aads generate --input bulk.xlsx --output output/bulk.xlsx --blocks 2,5
```

---

## `aads apply-actions`

Convert action items (negative keywords, keyword additions, placement adjustments, etc.) from a JSON config into a bulk sheet.

### Usage

```bash
aads apply-actions --config <file> --output <file>
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--config <file>` | Yes | Action items JSON config file path |
| `--output <file>` | Yes | Output Excel (.xlsx) file path |

### Config JSON Format

```json
{
  "description": "Optional description of the action set",
  "actions": [
    {
      "type": "negative_keyword",
      "campaignId": "123456789",
      "campaignName": "Campaign Name",
      "adGroupId": "987654321",
      "adGroupName": "AdGroup Name",
      "keywordText": "keyword to negate",
      "matchType": "exact"
    },
    {
      "type": "negative_product_targeting",
      "campaignId": "123456789",
      "campaignName": "Campaign Name",
      "asin": "B0COMPETITOR"
    },
    {
      "type": "keyword",
      "campaignId": "123456789",
      "campaignName": "Campaign Name",
      "adGroupId": "987654321",
      "adGroupName": "AdGroup Name",
      "keywordText": "new keyword",
      "matchType": "phrase",
      "bid": 75
    },
    {
      "type": "placement",
      "campaignId": "123456789",
      "campaignName": "Campaign Name",
      "placement": "Top of Search",
      "percentage": 50
    }
  ]
}
```

### Action Types

| Type | Entity | Description |
|------|--------|-------------|
| `negative_keyword` | Negative Keyword / Campaign Negative Keyword | Add negative keyword. Ad group level if adGroupId is provided, campaign level otherwise |
| `negative_product_targeting` | Negative Product Targeting | Add negative product targeting |
| `keyword` | Keyword | Add keyword (with optional bid) |
| `placement` | Campaign | Placement bid adjustment |

### Example

```bash
aads apply-actions --config data/samples/action-items-sample.json --output output/actions.xlsx
```

---

## `aads create-campaign`

Convert campaign structure from a JSON config into a bulk sheet. Supports two modes: create (new campaigns) and update (existing campaigns).

### Usage

```bash
aads create-campaign --config <file> --output <file> [--mode <create|update>] [--input <file>]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--config <file>` | Yes | Campaign template JSON config file path |
| `--output <file>` | Yes | Output Excel (.xlsx) file path |
| `--mode <mode>` | No | `create` (default) or `update` |
| `--input <file>` | For update mode | SC bulk sheet path (for ID resolution) |

### 設定JSONフォーマット

```json
{
  "brandName": "BrandName",
  "brandCode": "BN",
  "dateSuffix": "2502",
  "portfolioId": "P_123456",
  "skus": ["SKU001", "SKU002"],
  "biddingStrategy": "Dynamic bids - down only",
  "negativeKeywords": ["competitor brand"],
  "campaigns": {
    "auto": {
      "enabled": true,
      "dailyBudget": 1000,
      "defaultBid": 50,
      "topOfSearchPercentage": 50
    },
    "phrase": {
      "enabled": true,
      "dailyBudget": 2000,
      "defaultBid": 60,
      "keywords": [
        { "text": "keyword one", "bid": 80 },
        { "text": "keyword two" }
      ]
    },
    "broad": {
      "enabled": true,
      "dailyBudget": 1500,
      "defaultBid": 40,
      "keywords": [
        { "text": "broad keyword" }
      ]
    },
    "asin": {
      "enabled": true,
      "dailyBudget": 3000,
      "defaultBid": 70,
      "targets": [
        { "asin": "B0COMPETITOR1", "bid": 90 },
        { "asin": "B0COMPETITOR2" }
      ]
    },
    "manual": [
      {
        "name": "Custom Campaign Name",
        "dailyBudget": 5000,
        "targetingType": "manual",
        "adGroups": [
          {
            "name": "Custom AG",
            "defaultBid": 100,
            "keywords": [{ "text": "exact keyword", "bid": 120 }]
          }
        ]
      }
    ]
  },
  "naming": {
    "campaignTemplate": "{brand}_{typeLabel}_{suffix}",
    "adGroupTemplate": "{code}_{descriptor}",
    "typeLabels": { "auto": "auto" },
    "adGroupDescriptors": { "auto": "auto" }
  }
}
```

### Campaign Types

| Type | Targeting | Description |
|------|-----------|-------------|
| `auto` | auto | Automatic targeting. No keywords required |
| `phrase` | manual | Phrase match keywords |
| `broad` | manual | Broad match keywords |
| `asin` | manual | Product targeting (ASIN-based) |
| `manual` | configurable | Freely defined campaign structure |

### Naming Convention

| Field | Default | Placeholders |
|-------|---------|--------------|
| `campaignTemplate` | `{brand}_{typeLabel}_{suffix}` | `{brand}`, `{code}`, `{typeLabel}`, `{suffix}` |
| `adGroupTemplate` | `{code}_{descriptor}` | `{brand}`, `{code}`, `{descriptor}` |

### Example

```bash
# Create new campaigns
aads create-campaign \
  --config data/samples/campaign-template-sample.json \
  --output output/campaign.xlsx

# Update existing campaigns (referencing SC bulk sheet)
aads create-campaign \
  --config campaign.json \
  --output output/update.xlsx \
  --mode update \
  --input sc-bulk.xlsx
```

---

## `aads measure-log`

Track advertising measures with timestamped notes. Data is stored in `./data/measure-log.json` in your working directory.

### Usage

```bash
# List all entries
aads measure-log --list [--format <type>] [--status <status>] [--pattern <id>]

# Add a new entry
aads measure-log --add --pattern <id> --name <text> --date <yyyy-mm-dd> [--note <text>]

# Remove an entry
aads measure-log --remove <id>

# Add a note to an existing entry
aads measure-log --id <entry-id> --note <text>
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--list` | No | List all entries (default if no action specified) |
| `--add` | No | Add a new entry |
| `--remove <id>` | No | Remove an entry by ID |
| `--id <entry-id>` | For `--note` | Target entry ID |
| `--note <text>` | No | Add a note (standalone with `--id`, or initial note with `--add`) |
| `--pattern <id>` | With `--add` | Measure pattern ID |
| `--name <text>` | With `--add` | Measure name |
| `--date <yyyy-mm-dd>` | With `--add` | Measure execution date |
| `--description <text>` | No | Measure description |
| `--status <status>` | No | `pending` \| `completed` |
| `--format <type>` | No | `console` (default) \| `json` \| `markdown` |

### Output

- **console**: Table with ID, date, pattern, name, status, notes count, reminder
- **json**: Full entry objects including notes array
- **markdown**: Markdown table with Notes column

### Example

```bash
# List all measures
aads measure-log --list

# Add a measure with an initial note
aads measure-log --add --pattern custom --name "Negative KW cleanup" --date 2026-03-08 --note "Removed 5 wasteful keywords"

# Add a follow-up note
aads measure-log --id abc123 --note "ACOS improved from 15% to 10%"

# View as JSON (includes full notes array)
aads measure-log --list --format json

# Filter by status
aads measure-log --list --status pending
```

---

## `aads measure-compare`

Compare before/after KPI snapshots for a measure to evaluate its effectiveness.

### Usage

```bash
aads measure-compare --pattern <id> --before <pattern> --after <pattern> [options]
```

### Options

| Option | Required | Description |
|--------|----------|-------------|
| `--pattern <id>` | Yes* | Measure pattern ID (*or use `--log-id`) |
| `--log-id <id>` | No | Resolve pattern and metadata from measure-log entry |
| `--before <pattern>` | Yes | Before input file path or wildcard |
| `--after <pattern>` | Yes | After input file path or wildcard |
| `--campaigns <list>` | No | Comma-separated campaign IDs or names to filter |
| `--asins <list>` | No | Comma-separated ASINs to filter |
| `--name <text>` | No | Measure name (for custom pattern) |
| `--description <text>` | No | Measure description |
| `--with-llm` | No | Run LLM analysis (requires API key, costs apply) |
| `--format <type>` | No | `console` (default) \| `json` \| `xlsx` |
| `--output <file>` | No | Output file path (for xlsx format) |

### Output

- Overall KPI comparison (before vs after)
- Criteria evaluation (pass/fail per pattern criteria)
- Per-campaign breakdown
- Budget simulation (if budget data available)
- Verdict: `improved`, `neutral`, or `degraded`

### Example

```bash
# Compare with a specific pattern
aads measure-compare --pattern revenue-growth --before "week1-*.xlsx" --after "week2-*.xlsx"

# Compare using a measure-log entry
aads measure-compare --log-id abc123 --before "before.xlsx" --after "after.xlsx"

# Filter by campaigns
aads measure-compare --pattern custom --before before.xlsx --after after.xlsx --campaigns "Campaign A,Campaign B"

# Export to Excel
aads measure-compare --pattern custom --before before.xlsx --after after.xlsx --format xlsx --output output/compare.xlsx
```
