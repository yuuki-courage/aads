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

---

## 日本語ガイド

### サンプルデータについて

`bulk-sheet-sample.csv` は Amazon Ads バルクシートの入力形式を示すダミーデータです。

### カラム一覧

| カラム名 | 必須 | 説明 |
|----------|------|------|
| Campaign ID | はい | キャンペーンの一意識別子 |
| Campaign Name | はい | キャンペーン名 |
| Ad Group ID | はい | 広告グループの一意識別子 |
| Ad Group Name | はい | 広告グループ名 |
| Keyword ID | いいえ | キーワードの一意識別子 |
| Keyword Text | はい | キーワードまたは検索語句 |
| Match Type | はい | マッチタイプ: `exact`（完全一致）, `phrase`（フレーズ一致）, `broad`（部分一致） |
| Targeting Type | いいえ | ターゲティング方式（例: `keyword`） |
| Clicks | はい | クリック数 |
| Impressions | はい | インプレッション数 |
| Spend | はい | 支出額 |
| Sales | はい | 売上額 |
| Orders | はい | 注文数 |
| Bid | いいえ | 入札額 |
| State | いいえ | ステータス: `enabled`（有効）, `paused`（一時停止）, `archived`（アーカイブ） |

### 日本語ヘッダーについて

CSVのヘッダーには日本語も使用できます。英語と日本語を混在させることも可能です。対応するヘッダー名の一覧は上記の [Japanese Headers](#japanese-headers) セクションを参照してください。全ての対応バリエーションは `src/config/constants.ts` で定義されています。

### 自分のデータを使う

1. バルクシートの CSV または XLSX ファイルを `data/input/` に配置します
2. 分析パイプラインを実行します:
   ```bash
   pnpm start --input data/input/your-file.csv
   ```
3. 結果は `data/output/` に出力されます

> **注意**: `data/input/` と `data/output/` は `.gitignore` で除外されており、実データがコミットされることはありません。
