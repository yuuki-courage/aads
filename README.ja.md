# aads

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

Amazon Ads スポンサープロダクト広告のパフォーマンス解析 CLI ツール。

Amazon Ads のバルクシートエクスポート（Excel/CSV）を読み込み、CPC入札最適化レポート、Auto→Manual昇格候補、ネガティブキーワード提案、SEOランキング連携レポートを生成します。

## 機能

| コマンド | 説明 |
|---------|------|
| `analyze` | バルクシートからKPI（CTR, CVR, ACOS, ROAS）を集計 |
| `summary` | キャンペーン構造サマリー + レイヤー別集計 |
| `cpc-report` | CPC入札最適化レポート（SEOランキング連携対応） |
| `promotion-report` | Auto→Manual昇格候補 + ネガティブキーワード提案 |
| `seo-report` | SEOオーガニック順位 × 広告キーワード統合レポート |

## インストール

```bash
npm install -g aads
```

インストールせずに使う場合:

```bash
npx aads --help
```

## クイックスタート

```bash
# バルクシートを解析
aads analyze --input "bulk-*.xlsx"

# キャンペーン構造サマリーを表示
aads summary --input "bulk-*.xlsx"

# CPC最適化レポートを生成
aads cpc-report --input "bulk-*.xlsx" --output cpc-report.xlsx

# 昇格レポートを生成
aads promotion-report --input "bulk-*.xlsx" --output promotion.xlsx

# SEO統合レポートを生成
aads seo-report --input "bulk-*.xlsx" --ranking-db ranking.db
```

## コマンド

### `analyze`

Amazon Ads バルクシートからキャンペーンKPIを集計します。

```bash
aads analyze --input <pattern> [--layer-policy <file>]
```

| オプション | 説明 |
|-----------|------|
| `--input <pattern>` | 入力Excel/CSVパスまたはワイルドカードパターン（必須） |
| `--layer-policy <file>` | キャンペーンレイヤーポリシーJSONパス |

### `summary`

キャンペーン構造と広告グループの詳細、レイヤー分類を表示します。

```bash
aads summary --input <pattern> [--layer-policy <file>]
```

### `cpc-report`

CPC入札最適化の推奨値をExcelレポートとして出力します。

```bash
aads cpc-report --input <pattern> --output <file> [--ranking-db <path>]
```

| オプション | 説明 |
|-----------|------|
| `--input <pattern>` | 入力Excel/CSVパスまたはワイルドカードパターン（必須） |
| `--output <file>` | 出力xlsxパス（必須） |
| `--ranking-db <path>` | SEO順位調整用のA_rank SQLite DBパス |

### `promotion-report`

Auto キャンペーンの検索語から Manual キャンペーンへの昇格候補を特定し、無駄な検索語にはネガティブキーワードを提案します。

```bash
aads promotion-report --input <pattern> --output <file>
```

### `seo-report`

広告キーワードとオーガニックSEOランキングデータを照合し、オーガニック順位が強いキーワードの入札削減機会を特定します。

```bash
aads seo-report --input <pattern> --ranking-db <path> [--output <file>] [--format <type>]
```

| オプション | 説明 |
|-----------|------|
| `--input <pattern>` | 入力Excel/CSVパスまたはワイルドカードパターン（必須） |
| `--ranking-db <path>` | A_rank SQLite DBパス（必須） |
| `--output <file>` | 出力ファイルパス |
| `--format <type>` | `console` \| `json` \| `xlsx`（デフォルト: `console`） |

## 設定

環境変数（または `.env` ファイル）で設定します:

| 変数 | デフォルト | 説明 |
|------|---------|------|
| `TARGET_ACOS` | `0.25` | CPC最適化の目標ACOS |
| `MIN_CLICKS_CPC` | `5` | CPC推奨の最小クリック数 |
| `MIN_CLICKS_PROMOTION` | `5` | 昇格候補の最小クリック数 |
| `MIN_CVR_PROMOTION` | `0.03` | 昇格候補の最小CVR |
| `NEGATIVE_ACOS_THRESHOLD` | `0.4` | ネガティブキーワード提案のACOS閾値 |
| `SEO_ENABLED` | `true` | SEOランキング連携を有効化 |
| `SEO_CPC_CEILING` | `0` | CPC上限（0 = 自動） |
| `RANKING_DB_PATH` | - | A_rank SQLite DBのデフォルトパス |
| `LOG_LEVEL` | `info` | ログレベル（`debug` \| `info`） |

テンプレートは [`.env.example`](.env.example) を参照してください。

## SEO連携

`cpc-report` と `seo-report` コマンドは、SQLiteデータベースに格納されたSEOランキングデータと連携できます（例: [A_rank](https://github.com/yuuki-courage/A_rank)）。

広告キーワードのオーガニック順位が強い場合（1-4位）、推奨CPC入札額を自動的に削減します:

| オーガニック順位 | SEO係数 | 入札削減率 |
|---------------|---------|----------|
| 1位 | 0.50 | -50% |
| 2位 | 0.60 | -40% |
| 3位 | 0.70 | -30% |
| 4位 | 0.80 | -20% |
| 5位以降 | 1.00 | 変更なし |

## キャンペーンレイヤーポリシー

`analyze` と `summary` コマンドは、JSONポリシーファイルによるキャンペーンレイヤー分類をサポートします:

```bash
aads summary --input "bulk-*.xlsx" --layer-policy data/campaign-layer-policy.json
```

デフォルトのポリシー構造は [`data/campaign-layer-policy.json`](data/campaign-layer-policy.json) を参照してください。

## コントリビュート

開発環境のセットアップとコントリビューションガイドラインは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)
