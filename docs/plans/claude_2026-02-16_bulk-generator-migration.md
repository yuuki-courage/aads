# バルクシートジェネレーター移植 + アカウント戦略テンプレート + 入力ガイド

## Context

OSS版 aads は分析パイプライン（CPC最適化、Auto→Manual昇格、ネガティブ提案）まで実装済みだが、分析結果をAmazon Adsバルクシートとして出力する機能がない。プライベートリポ `yuuki-courage/AmazonAds` の `src/generators/` を移植し、「入力→分析→バルクシート生成」の一気通貫フローを完成させる。

併せて、アカウント戦略テンプレートと `data/input/` の案内ファイルも追加する。

## スコープ

- **含む**: Block 1-5 ジェネレーター、generate-pipeline、id-spine、placement-analyzer、CLI `generate` コマンド、アカウントテンプレート、入力ガイド
- **含まない**: Block 195（セールCPC）、Block 500（キャンペーンテンプレート）、Notion連携、Measure系 → 別PR

## 変更対象ファイル

### 新規作成（14ファイル）

| ファイル | 概要 | 行数目安 |
|----------|------|----------|
| `src/core/id-spine.ts` | キャンペーン/広告グループ/キーワードのID逆引き | ~55 |
| `src/analysis/placement-analyzer.ts` | プレースメント別CVR分析＆入札修飾子推奨 | ~140 |
| `src/generators/row-builders.ts` | BulkOutputRow構築ユーティリティ | ~55 |
| `src/generators/block1-budget.ts` | 予算調整行生成 | ~45 |
| `src/generators/block2-cpc.ts` | CPC入札更新行生成 | ~35 |
| `src/generators/block3-promotion.ts` | Auto→Manual昇格行生成 | ~55 |
| `src/generators/block3-5-negative-sync.ts` | 昇格後ネガティブ同期 | ~25 |
| `src/generators/block4-negative.ts` | ネガティブキーワード行生成 | ~25 |
| `src/generators/block5-placement.ts` | プレースメント入札修飾行生成 | ~50 |
| `src/generators/bulk-output.ts` | ブロック統合＆重複排除 | ~45 |
| `src/pipeline/generate-pipeline.ts` | ジェネレーターオーケストレーション | ~50 |
| `src/__tests__/generators.test.ts` | ジェネレーター全体テスト | ~200 |
| `accounts/_template/strategy.md` | アカウント戦略テンプレート | ~50 |
| `data/input/README.md` | 入力ファイル配置ガイド | ~25 |

### 編集（5ファイル）

| ファイル | 変更内容 |
|----------|----------|
| `src/pipeline/types.ts` | `BulkOutputRow`, `StrategyData`, `GeneratePipelineInput`, `GeneratePipelineResult`, `PlacementRecommendation` 型追加。`NormalizedRecord` に `placement` フィールド追加 |
| `src/config/constants.ts` | `BULK_SCHEMA_HEADER_V210` (27カラム) 追加。`HEADER_CANDIDATES` に `placement` エントリ追加 |
| `src/pipeline/analyze-pipeline.ts` | `normalizeRecord()` に `placement: asText(map.placement)` 追加 |
| `src/cli.ts` | `generate` コマンド追加 |
| `.gitignore` | `accounts/` 除外（`!accounts/_template/` 例外）、`!data/input/README.md` 例外 |

## 実装ステップ

### Step 1: 型・定数の基盤整備
- types.ts に BulkOutputRow, StrategyData, GeneratePipelineInput, GeneratePipelineResult 型追加
- NormalizedRecord に placement フィールド追加
- constants.ts に BULK_SCHEMA_HEADER_V210 と placement ヘッダー候補追加

### Step 2: analyze-pipeline 修正
- normalizeRecord() に placement フィールド追加
- 既存テストの makeRecord に placement: "" 追加

### Step 3: 支援モジュール
- src/core/id-spine.ts — ID逆引きスパイン
- src/analysis/placement-analyzer.ts — プレースメント分析

### Step 4: ジェネレーター移植
- row-builders.ts, block1-5, block3-5, bulk-output.ts

### Step 5: generate-pipeline
- 全ブロックオーケストレーション

### Step 6: CLI generate コマンド

### Step 7: テンプレート & ガイド

### Step 8: テスト

## 検証方法

1. `pnpm typecheck` — 型チェック通過
2. `pnpm test` — 既存53テスト + 新規テスト全パス
3. `pnpm lint` — lint通過
4. E2E手動テスト

## デプロイ要否

不要（CLIツール、ローカル実行のみ）
