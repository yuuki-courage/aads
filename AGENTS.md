# AGENTS.md — aads-cli (Codex向け指示書)

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

## ビルド・テスト

```bash
npx tsc --noEmit     # 型チェック
pnpm run build       # ビルド
pnpm test            # テスト
npm run dev -- <cmd> # 開発時実行
```

## コミットルール

Conventional Commits 形式を使用:
- `feat:` — 新機能
- `fix:` — バグ修正
- `docs:` — ドキュメント
- `refactor:` — リファクタリング
- `test:` — テスト
- `chore:` — メンテナンス
