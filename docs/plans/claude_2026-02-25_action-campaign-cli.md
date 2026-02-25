# プラン: apply-actions / create-campaign CLI + block5修正 + AIエージェント設定

- 日付: 2026-02-25
- ブランチ: feat/claude-action-campaign-cli
- 担当: claude

## ゴール

- [ ] `aads apply-actions --config <file> --output <file>` で施策アクションをバルクシート化
- [ ] `aads create-campaign --config <file> --output <file>` でキャンペーン構造をバルクシート化（create / update モード）
- [ ] 命名規則を config JSON 内で保存・参照する仕組み
- [ ] `block5-placement.ts` の Entity 修正（generate コマンドの既存バグ修正）
- [ ] CLAUDE.md / AGENTS.md / GEMINI.md でCLI優先実行を強制

## スコープ外

- Notion連携（実務リポジトリ固有）
- 対話形式のインタラクティブCLI（Claude Codeが担う領域）
- Zodバリデーション（現在の依存にZodがないため、手動バリデーションで対応）
- Block 195（セールCPC）の移植（実務固有機能）

## 変更対象ファイル

- `src/pipeline/types.ts` — ActionItem, ActionItemsConfig 型追加
- `src/config/campaign-template-defaults.ts` — 新規: デフォルト値・命名パターン・バリデーション関数・キャンペーン型定義
- `src/generators/apply-actions.ts` — 新規: アクションアイテム→BulkOutputRow変換
- `src/generators/campaign-template.ts` — 新規: キャンペーンテンプレート生成エンジン
- `src/generators/block5-placement.ts` — Entity修正
- `src/cli.ts` — 2コマンド登録
- `src/config/constants.ts` — B500_CAMPAIGN_HEADER 追加
- `src/__tests__/apply-actions.test.ts` — 新規テスト
- `src/__tests__/campaign-template.test.ts` — 新規テスト
- `data/samples/action-items-sample.json` — サンプルconfig
- `data/samples/campaign-template-sample.json` — サンプルconfig
- `CLAUDE.md` — AIエージェント設定
- `AGENTS.md` — Codex向け設定
- `GEMINI.md` — Gemini向け設定
- `docs/cli-reference.md` — ドキュメント更新

## 作業項目

### 設計・準備
- [ ] feature ブランチ作成
- [ ] プラン文書保存

### 実装
- [ ] block5-placement.ts Entity修正
- [ ] types.ts に ActionItem/ActionItemsConfig 追加
- [ ] constants.ts に B500_CAMPAIGN_HEADER 追加
- [ ] campaign-template-defaults.ts 新規作成
- [ ] apply-actions.ts ジェネレーター新規作成
- [ ] campaign-template.ts ジェネレーター新規作成
- [ ] cli.ts にコマンド登録

### テスト
- [ ] apply-actions.test.ts 新規作成
- [ ] campaign-template.test.ts 新規作成

### ドキュメント・設定
- [ ] サンプルconfig作成
- [ ] CLAUDE.md / AGENTS.md / GEMINI.md 作成
- [ ] docs/cli-reference.md 更新
- [ ] package.json バージョンバンプ

## 検証方法

- [ ] `npx tsc --noEmit`
- [ ] `pnpm test`
- [ ] CLI実行確認

## デプロイ要否

- Trigger.dev: 不要
- Vercel: 不要
