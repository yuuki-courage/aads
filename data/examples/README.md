# Example Data

This directory contains sample CSV files that demonstrate the expected input format for AADS (Amazon Ads Data Suite).

## bulk-sheet-sample.csv

A minimal example of an Amazon Ads bulk sheet with dummy data.

### Columns

| Column | Required | Description |
|--------|----------|-------------|
| Campaign ID | Yes | Unique identifier for the campaign |
| Campaign Name | Yes | Name of the campaign |
| Ad Group ID | Yes | Unique identifier for the ad group |
| Ad Group Name | Yes | Name of the ad group |
| Keyword ID | No | Unique identifier for the keyword |
| Keyword Text | Yes | The keyword or search term |
| Match Type | Yes | Keyword match type: `exact`, `phrase`, or `broad` |
| Targeting Type | No | Targeting strategy (e.g., `keyword`) |
| Clicks | Yes | Number of clicks |
| Impressions | Yes | Number of impressions |
| Spend | Yes | Total spend amount |
| Sales | Yes | Total sales amount |
| Orders | Yes | Number of orders |
| Bid | No | Bid amount for the keyword |
| State | No | Status: `enabled`, `paused`, or `archived` |

### Japanese Headers

AADS also supports Japanese column headers. For example:

| English | Japanese |
|---------|----------|
| Campaign ID | キャンペーンID |
| Campaign Name | キャンペーン名 |
| Ad Group ID | 広告グループID |
| Ad Group Name | 広告グループ名 |
| Keyword Text | キーワードテキスト |
| Match Type | マッチタイプ |
| Clicks | クリック数 |
| Impressions | インプレッション数 |
| Spend | 支出 |
| Sales | 売上 |
| Orders | 注文数 |
| Bid | 入札額 |
| State | キャンペーンのステータス |

You can mix English and Japanese headers in the same file. See `src/config/constants.ts` for the full list of recognized header variants.

## Using Your Own Data

1. Place your bulk sheet CSV or XLSX files in `data/input/`
2. Run the analysis pipeline:
   ```bash
   pnpm start --input data/input/your-file.csv
   ```
3. Results will be written to `data/output/`

> **Note**: Files in `data/input/` and `data/output/` are git-ignored to prevent committing real advertising data.
