# Claude関連ファイルの.gitignore設定

## Context（背景）

このリポジトリはOSSの公開プロジェクトです。Claude Code関連の設定ファイルやローカル環境固有のファイルがリモートリポジトリに誤ってプッシュされないように、`.gitignore`に適切なパターンを追加する必要があります。

現在、`.gitignore`には他のAIエージェント（Antigravity、Gemini）の設定は含まれていますが、Claude関連の設定がまだありません。

## 対象ファイル

- `.gitignore` - Claude関連のパターンを追加

## 追加すべきパターン（ユーザー確認済み）

```gitignore
# Claude Code
.claude/
```

`.claude/`ディレクトリには以下が含まれる可能性があります：
- `.claude/mcp.json` - MCP設定（プロジェクト固有のサーバー設定）
- `.claude/commands/` - カスタムコマンド
- `.claude/plans/` - 一時プランファイル（最終版は`docs/plans/`に保存）
- `.claude/CLAUDE.md` - プロジェクト固有の指示（個人設定として非公開）
- その他のローカル設定ファイル

**決定事項**: `.claude/`全体を無視（例外なし）

## 実装ステップ

1. ユーザーに`CLAUDE.md`の扱いを確認（✓ 完了）
2. `.gitignore`に選択されたパターンを追加
3. 既存のパターン（Antigravity/Gemini）の近くに配置して一貫性を保つ
4. `git status`で意図しないファイルが追跡されていないか確認

## 検証方法

1. `.gitignore`の変更を確認：`git diff .gitignore`
2. `.claude/`ディレクトリ（存在する場合）が無視されているか確認：`git status`
3. 必要に応じて、テスト用に`.claude/test.txt`を作成して無視されるか確認

## デプロイ要否

不要（設定ファイルの変更のみ）
