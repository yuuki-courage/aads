# GEMINI.md — aads-cli (Gemini向け指示書)

## CLI優先ルール

バルクシート生成・分析は必ず `aads` CLI を使用すること。
Excel/CSVの手動加工やPythonスクリプトでのバルクシート生成は禁止。

## コマンド一覧

- `aads analyze --input <pattern>` — KPI集計
- `aads summary --input <pattern>` — キャンペーン構造サマリー
- `aads cpc-report --input <pattern> --output <file>` — CPC入札最適化レポート
- `aads promotion-report --input <pattern> --output <file>` — Auto→Manual昇格候補
- `aads seo-report --input <pattern> --ranking-db <path>` — SEOランキングレポート
- `aads generate --input <pattern> --output <file> [--blocks <list>]` — バルクシート生成
- `aads apply-actions --config <file> --output <file>` — 施策アクション適用
- `aads create-campaign --config <file> --output <file> [--mode <create|update>]` — キャンペーン構造生成

## 実行確認フロー

コード変更後は以下を必ず実行:

1. `npx tsc --noEmit` — 型チェック
2. `pnpm run build` — ビルド
3. `pnpm test` — テスト
4. 該当CLIコマンドの動作確認
