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

分析結果からAmazon Adsバルクシートを生成します。

### 使用方法

```bash
aads generate --input <pattern> --output <file> [--blocks <list>]
```

### オプション

| オプション | 必須 | 説明 |
|--------|----------|-------------|
| `--input <pattern>` | Yes | 入力ファイルパスまたはワイルドカード |
| `--output <file>` | Yes | 出力Excelファイルパス |
| `--blocks <list>` | No | 実行するブロック番号（カンマ区切り: 1,2,3,3.5,4,5） |

### ブロック一覧

| ブロック | 内容 |
|---------|------|
| 1 | 予算更新 |
| 2 | CPC入札更新 |
| 3 | Auto→Manual昇格キーワード作成 |
| 3.5 | 昇格キーワードのネガティブ同期 |
| 4 | ネガティブキーワード作成 |
| 5 | プレースメント入札調整 |

### 実行例

```bash
# 全ブロック実行
aads generate --input "bulk-*.xlsx" --output output/bulk.xlsx

# 特定ブロックのみ
aads generate --input bulk.xlsx --output output/bulk.xlsx --blocks 2,5
```

---

## `aads apply-actions`

施策アクション（ネガティブKW追加、キーワード追加、プレースメント調整等）をJSON設定からバルクシートに変換します。

### 使用方法

```bash
aads apply-actions --config <file> --output <file>
```

### オプション

| オプション | 必須 | 説明 |
|--------|----------|-------------|
| `--config <file>` | Yes | アクションアイテム設定JSONファイルパス |
| `--output <file>` | Yes | 出力Excelファイルパス |

### 設定JSONフォーマット

```json
{
  "description": "施策の説明（任意）",
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

### アクションタイプ

| タイプ | Entity | 説明 |
|--------|--------|------|
| `negative_keyword` | Negative Keyword / Campaign Negative Keyword | ネガティブKW追加。adGroupIdがあれば広告グループレベル、なければキャンペーンレベル |
| `negative_product_targeting` | Negative Product Targeting | ネガティブ商品ターゲティング追加 |
| `keyword` | Keyword | キーワード追加（入札額指定可） |
| `placement` | Campaign | プレースメント入札調整 |

### 実行例

```bash
aads apply-actions --config data/samples/action-items-sample.json --output output/actions.xlsx
```

---

## `aads create-campaign`

キャンペーン構造をJSON設定からバルクシートに変換します。新規作成（create）と既存更新（update）の2モードをサポート。

### 使用方法

```bash
aads create-campaign --config <file> --output <file> [--mode <create|update>] [--input <file>]
```

### オプション

| オプション | 必須 | 説明 |
|--------|----------|-------------|
| `--config <file>` | Yes | キャンペーンテンプレート設定JSONファイルパス |
| `--output <file>` | Yes | 出力Excelファイルパス |
| `--mode <mode>` | No | `create`（デフォルト）または `update` |
| `--input <file>` | updateモード時必須 | SCバルクシートパス（ID解決用） |

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

### キャンペーンタイプ

| タイプ | ターゲティング | 説明 |
|--------|--------------|------|
| `auto` | auto | 自動ターゲティング。キーワード不要 |
| `phrase` | manual | フレーズ一致キーワード |
| `broad` | manual | 部分一致キーワード |
| `asin` | manual | 商品ターゲティング（ASIN指定） |
| `manual` | 設定による | 自由定義のキャンペーン構造 |

### 命名規則（NamingConvention）

| フィールド | デフォルト | プレースホルダー |
|-----------|-----------|----------------|
| `campaignTemplate` | `{brand}_{typeLabel}_{suffix}` | `{brand}`, `{code}`, `{typeLabel}`, `{suffix}` |
| `adGroupTemplate` | `{code}_{descriptor}` | `{brand}`, `{code}`, `{descriptor}` |

### 実行例

```bash
# 新規キャンペーン作成
aads create-campaign \
  --config data/samples/campaign-template-sample.json \
  --output output/campaign.xlsx

# 既存キャンペーン更新（SCバルクシート参照）
aads create-campaign \
  --config campaign.json \
  --output output/update.xlsx \
  --mode update \
  --input sc-bulk.xlsx
```
