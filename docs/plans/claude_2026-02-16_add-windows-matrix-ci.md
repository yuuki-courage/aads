# GitHub Actions に Windows マトリクスCI を追加

## Context
aads は Node.js CLI ツール（Amazon Ads 分析）。現在の CI は ubuntu-latest のみ。
Windows ユーザーも使う OSS なので、Windows でもテスト・ビルドが通ることを CI で保証したい。

## 変更対象ファイル
- `.github/workflows/ci.yml`（既存ファイルの書き換え）

## 現状の CI 構成
- OS: ubuntu-latest のみ
- Node: 18, 20, 22 のマトリクス
- ステップ: lint → format:check → typecheck → test → build → CLI verify
- 問題: Lint/Format が全 OS×Node で重複実行される（無駄）

## 設計方針

### ジョブを2つに分離

**1. `lint` ジョブ（ubuntu-latest, Node 22 のみ）**
- `pnpm lint`
- `pnpm format:check`
- OS・Node バージョンに依存しないため1回で十分

**2. `test` ジョブ（OS × Node マトリクス）**
- OS: `ubuntu-latest`, `windows-latest`
- Node: 18, 20, 22
- ステップ: typecheck → test → build → CLI verify
- `lint` ジョブ完了後に実行（`needs: lint`）

### 理由
- Lint/Format は OS に依存しない → 重複排除でCI時間・コスト削減
- typecheck/test/build は OS + Node バージョン依存 → マトリクスで網羅
- better-sqlite3 はネイティブモジュールだが prebuild バイナリがあるため Windows でも `pnpm install` で動く
- テストコードは better-sqlite3 を直接使っていない → テストは確実に通る

### 課金について
- **パブリックリポジトリ**: 全 OS 無料（確認済み）

## 実装ステップ

1. feature ブランチ作成
2. `.github/workflows/ci.yml` を書き換え
3. コミット・プッシュ・PR作成
4. CI 通過を確認

## 検証方法
- PR の CI が全マトリクス（ubuntu×3 + windows×3 = 6ジョブ + lint 1 = 計7ジョブ）で green になること
- `gh pr checks` で確認

## デプロイ要否
不要（CI設定のみ）

## Orchestra調査
スキップ（1ファイルのみの既知パターン）
