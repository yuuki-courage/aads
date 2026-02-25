# CLAUDE.md — aads-cli プロジェクト指示書

## CLI優先ルール（最重要）

**バルクシート生成・分析は必ず `aads` CLI を使用すること。**

- Excel/CSVの手動加工やPythonスクリプトでのバルクシート生成を**禁止**
- バルクシートのパスを渡されたら、まず `aads` CLI のコマンドで処理できるか確認すること
- CLI で対応できない操作のみ、ユーザーに確認の上で別手段を検討

## 利用可能コマンド一覧

| コマンド | 用途 | 主要オプション |
|---------|------|---------------|
| `aads analyze` | KPI集計（CTR, CVR, ACOS, ROAS） | `--input <pattern>` |
| `aads summary` | キャンペーン構造サマリー | `--input <pattern> [--layer-policy <file>]` |
| `aads cpc-report` | CPC入札最適化レポート | `--input <pattern> --output <file> [--ranking-db <path>]` |
| `aads promotion-report` | Auto→Manual昇格候補 | `--input <pattern> --output <file>` |
| `aads seo-report` | SEOランキング×広告KWレポート | `--input <pattern> --ranking-db <path> [--format <type>]` |
| `aads generate` | 分析結果からバルクシート生成 | `--input <pattern> --output <file> [--blocks <list>]` |
| `aads apply-actions` | 施策アクションをバルクシート化 | `--config <file> --output <file>` |
| `aads create-campaign` | キャンペーン構造をバルクシート化 | `--config <file> --output <file> [--mode <create\|update>] [--input <file>]` |

### 実行例

```bash
# 分析
npx tsx src/cli.ts analyze --input "data/input/bulk-*.xlsx"

# バルクシート生成（全ブロック）
npx tsx src/cli.ts generate --input bulk.xlsx --output output/bulk.xlsx

# 施策アクション適用
npx tsx src/cli.ts apply-actions --config actions.json --output output/actions.xlsx

# キャンペーン新規作成
npx tsx src/cli.ts create-campaign --config campaign.json --output output/campaign.xlsx

# キャンペーン更新（既存SCバルクシート参照）
npx tsx src/cli.ts create-campaign --config campaign.json --output output/update.xlsx --mode update --input sc-bulk.xlsx
```

## create-campaign ワークフロー

ユーザーがキャンペーン作成を依頼した場合：

1. ブランド名・コード・日付サフィックスを確認
2. キャンペーンタイプ（auto/phrase/broad/asin/manual）と設定を確認
3. SKU一覧を確認
4. 命名規則（NamingConvention）をカスタマイズするか確認
5. config JSON を生成
6. `aads create-campaign --config <file> --output <file>` を実行

## 開発フロー

```bash
npm run typecheck    # 型チェック
npm run build        # ビルド
pnpm test            # テスト実行
npm run dev -- <cmd> # 開発時の実行（npx tsx src/cli.ts と同等）
```

## 完了定義（DoD）

コード変更時は以下を全て通過させること：

1. `npx tsc --noEmit` — 型チェック通過
2. `pnpm run build` — ビルド通過
3. `pnpm test` — 全テスト通過
4. 該当CLIコマンドの実行確認（サンプルデータで動作確認）
