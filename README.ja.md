<p align="center">
  <img src="packages/website/public/logo.svg" width="64" height="64" alt="Vincu logo">
</p>

<h1 align="center">Vincu</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/getvincu/vincu/stargazers">
    <img src="https://img.shields.io/github/stars/getvincu/vincu?style=flat&logo=github" alt="GitHub stars">
  </a>
  <a href="https://github.com/getvincu/vincu/releases">
    <img src="https://img.shields.io/github/v/release/getvincu/vincu?style=flat&logo=github" alt="GitHub release">
  </a>
  <a href="https://x.com/moboudra">
    <img src="https://img.shields.io/badge/%40moboudra-555?logo=x" alt="X">
  </a>
  <a href="https://discord.gg/jz8T2uahpH">
    <img src="https://img.shields.io/badge/Discord-555?logo=discord" alt="Discord">
  </a>
  <a href="https://www.reddit.com/r/VincuAI/">
    <img src="https://img.shields.io/badge/Reddit-555?logo=reddit" alt="Reddit">
  </a>
</p>

<p align="center">Claude Code、Codex、Copilot、OpenCode、Pi のエージェントを、ひとつのインターフェースで。</p>

<p align="center">
  <img src="https://vincu.sh/hero-mockup.png" alt="Vincu アプリのスクリーンショット" width="100%">
</p>

<p align="center">
  <img src="https://vincu.sh/mobile-mockup.png" alt="Vincu モバイルアプリ" width="100%">
</p>

> [!NOTE]
> 私はひとりでメンテナンスしているため、GitHub Issues を毎日確認できるとは限りません。
> 急ぎの問題や作業がブロックされている場合は、[Discord](https://discord.gg/jz8T2uahpH) から連絡するのが一番早いです。

---

自分のマシンでエージェントを並列実行。スマートフォンからでもデスクからでも、開発を進めてリリースできます。

- **セルフホスト:** エージェントはあなたのマシン上で動作し、完全な開発環境を使用します。自分のツール・設定・スキルをそのまま活用できます。
- **マルチプロバイダー:** Claude Code、Codex、Copilot、OpenCode、Pi を同一のインターフェースで利用。タスクに合ったモデルを選べます。
- **音声コントロール:** 音声モードでタスクを口述したり問題を話し合ったりできます。ハンズフリーが必要なときに便利です。
- **クロスデバイス:** iOS、Android、デスクトップ、Web、CLI に対応。机で作業を始め、スマートフォンで確認し、ターミナルから自動化できます。
- **プライバシー優先:** Vincu にはテレメトリー・トラッキング・強制ログインは一切ありません。

## はじめかた

Vincu はコーディングエージェントを管理するローカルサーバー（デーモン）を起動します。デスクトップアプリ・モバイルアプリ・Web アプリ・CLI などのクライアントがこのデーモンに接続します。

### 前提条件

エージェント CLI をひとつ以上インストールし、認証情報を設定しておく必要があります。

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex](https://github.com/openai/codex)
- [GitHub Copilot](https://github.com/features/copilot/cli/)
- [OpenCode](https://github.com/anomalyco/opencode)
- [Pi](https://pi.dev)

### デスクトップアプリ（推奨）

[vincu.sh/download](https://vincu.sh/download) または [GitHub のリリースページ](https://github.com/getvincu/vincu/releases)からダウンロードしてください。アプリを開くとデーモンが自動的に起動します。追加のインストールは不要です。

スマートフォンから接続するには、Settings 画面に表示される QR コードをスキャンしてください。

### CLI / ヘッドレス

CLI をインストールして Vincu を起動します。

```bash
npm install -g @getvincu/cli
vincu
```

ターミナルに QR コードが表示されます。どのクライアントからでも接続できます。サーバーやリモートマシンでの利用に適しています。

詳しいセットアップと設定については以下を参照してください。

- [ドキュメント](https://vincu.sh/docs)
- [設定リファレンス](https://vincu.sh/docs/configuration)

## CLI

アプリでできることはすべてターミナルからも実行できます。

```bash
vincu run --provider claude/opus-4.6 "implement user authentication"
vincu run --provider codex/gpt-5.4 --worktree feature-x "implement feature X"

vincu ls                           # 実行中のエージェントを一覧表示
vincu attach abc123                # ライブ出力をストリーミング
vincu send abc123 "also add tests" # 追加タスクを送信

# リモートデーモンで実行
vincu --host workstation.local:6767 run "run the full test suite"
```

詳細は[完全な CLI リファレンス](https://vincu.sh/docs/cli)を参照してください。

## スキル

スキルはエージェントに Vincu を使って他のエージェントをオーケストレーションする方法を教えます。

```bash
npx skills add getvincu/vincu
```

どのエージェントとの会話でも使用できます。

- `/vincu-handoff` — エージェント間で作業を引き継ぎます。私はこれを使って Claude で計画し、Codex に実装を引き継いでいます。
- `/vincu-loop` — 明確な受け入れ基準に沿ってエージェントをループさせます（Ralph loops とも呼ばれます）。検証役を追加することもできます。
- `/vincu-advisor` — 単一のエージェントをアドバイザーとして起動し、作業を委任せずにセカンドオピニオンを得ます。
- `/vincu-committee` — 対照的な2つのエージェントで委員会を構成し、一歩引いた視点で根本原因を分析して計画を作成します。

## 開発

モノレポのパッケージ構成：

- `packages/server`: Vincu デーモン（エージェントプロセスのオーケストレーション、WebSocket API、MCP サーバー）
- `packages/app`: Expo クライアント（iOS、Android、Web）
- `packages/cli`: デーモンおよびエージェントワークフロー向け `vincu` CLI
- `packages/desktop`: Electron デスクトップアプリ
- `packages/relay`: リモート接続用リレーパッケージ
- `packages/website`: マーケティングサイトとドキュメント（`vincu.sh`）

よく使うコマンド：

```bash
# すべてのローカル開発サービスを起動
npm run dev

# 個別のサービスを起動
npm run dev:server
npm run dev:app
npm run dev:desktop
npm run dev:website

# サーバースタックをビルド
npm run build:server

# リポジトリ全体のチェック
npm run typecheck
```

## 関連プロジェクト

- [getvincu/vincu-relay](https://github.com/getvincu/vincu-relay) — Elixir 製の公式分散リレー
- [vincu-skins](https://github.com/huangguang1999/vincu-skins) — Vincu デスクトップ向けコミュニティテーマと、Agent Skill 対応のゼロパッチテーマローダー
- [vincu-vscode](https://marketplace.visualstudio.com/items?itemName=hinnes.vincu-vscode) — VS Code 拡張機能

## ライセンス

AGPL-3.0
