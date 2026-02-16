# .gitignore 修正 + サンプルデータ作成

## Context

OSSリポジトリとして公開済みだが、以下の課題がある:
- `.claude/` が `.gitignore` に含まれていない（Claude Code設定がコミットされるリスク）
- `data/output/` が `.gitignore` に含まれていない（`output/` はあるが `data/output/` は別パス）
- `*.csv` がグローバルで除外されているため、サンプルCSVを追加するには例外ルールが必要
- 入力データの形式を示すサンプルデータが存在しない

## 変更対象ファイル

| ファイル | 操作 |
|----------|------|
| `.gitignore` | 編集 |
| `data/examples/bulk-sheet-sample.csv` | 新規作成 |
| `data/examples/README.md` | 新規作成 |

## 実装ステップ

### Step 1: `.gitignore` 修正

`.gitignore` に以下を追加:

```gitignore
# Claude Code settings
.claude/

# Output data
data/output/

# Allow example CSV files
!data/examples/*.csv
```

**注意**: 既存の `*.csv` ルールがあるため、`!data/examples/*.csv` で例外を設定しないとサンプルCSVがトラッキングされない。

### Step 2: サンプルCSV作成 (`data/examples/bulk-sheet-sample.csv`)

Amazon Ads バルクシートの構造を示すダミーデータ。5行程度。以下のカラムを含む:

- Campaign ID, Campaign Name, Ad Group ID, Ad Group Name
- Keyword Text, Match Type, Targeting Type
- Clicks, Impressions, Spend, Sales, Orders
- Bid, State

**ポイント**:
- 実データは含めない（全てダミー値）
- 異なるマッチタイプ（exact, phrase, broad）を含める
- 異なるステータス（enabled, paused）を含める
- 日本語ヘッダーは使わず英語ヘッダーのみ（OSSとして国際対応）

### Step 3: サンプルデータREADME作成 (`data/examples/README.md`)

内容:
- CSVの各カラムの説明（必須/任意を明記）
- 日本語ヘッダーも使用可能であることの説明
- `data/input/` に実データを配置する方法の案内

## デプロイ要否

不要（ドキュメント・設定ファイルのみ）

## 検証方法

1. `git check-ignore .claude/` → 除外されることを確認
2. `git check-ignore data/output/test.txt` → 除外されることを確認
3. `git check-ignore data/examples/bulk-sheet-sample.csv` → 除外されない（トラッキングされる）ことを確認
4. `git add --dry-run data/examples/` → サンプルファイルがステージング可能であることを確認
5. `pnpm typecheck && pnpm test && pnpm lint` → 既存テスト通過を確認
