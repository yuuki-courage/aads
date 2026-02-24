# プラン: PR #27 のシートフィルタリング修正をOSSリポジトリに適用

- 日付: 2026-02-25
- ブランチ: feat/claude-fix-sheet-filter
- 担当: claude

## ゴール

- [ ] `readBulkExcelFiles`にシートフィルタリングオプションを追加し、デフォルトで検索ワードレポートシートのみ読み込むように修正
- [ ] `analyze`コマンドのファイル数表示を物理ファイル数に修正

## スコープ外

- analyze-pipeline.tsの`readInputs`関数の呼び出し変更（デフォルト値で対応するため不要）
- テストの追加（運用環境でも追加されていないため、別途対応）

## 変更対象ファイル

- `src/io/excel-reader.ts` — シートフィルタリングオプション追加
- `src/cli.ts` — ファイル数カウントの修正

## 作業項目

### 実装

- [ ] `src/io/excel-reader.ts`: `SEARCH_TERM_REPORT_SHEETS`定数を追加（`["SP検索ワードレポート", "SB検索ワードレポート"]`）
- [ ] `src/io/excel-reader.ts`: `ReadBulkOptions`インターフェースを追加（`sheetsFilter?: "search-term-only" | "all"`）
- [ ] `src/io/excel-reader.ts`: `readBulkExcelFiles`の引数にオプションを追加し、デフォルト`"search-term-only"`でフィルタリング
- [ ] `src/cli.ts` L129: `files: result.input.length` → `files: new Set(result.input.map((i) => i.sourceFile.replace(/#.*$/, ""))).size`

### 検証

- [ ] `npx tsc --noEmit` 型チェック通過
- [ ] `npm run build` ビルド通過
- [ ] `npm test` テスト通過

## 検証方法

- コマンド: `npx tsc --noEmit`
- コマンド: `npm run build`
- コマンド: `npm test`

## デプロイ要否

- Trigger.dev: 不要
- Vercel: 不要
- npm publish: 今回は不要（バージョンバンプは別途判断）

## Orchestra 調査結果

スキップ。2ファイルの既知パターン修正。運用環境で検証済みの同一変更の移植。
