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

<p align="center">One interface for Claude Code, Codex, Copilot, OpenCode, and Pi agents.</p>

<p align="center">
  <img src="https://vincu.sh/hero-mockup.png" alt="Vincu app screenshot" width="100%">
</p>

<p align="center">
  <img src="https://vincu.sh/mobile-mockup.png" alt="Vincu mobile app" width="100%">
</p>

Run agents in parallel on your own machines. Ship from your phone or your desk.

- **Self-hosted:** Agents run on your machine with your full dev environment. Use your tools, your configs, and your skills.
- **Multi-provider:** Claude Code, Codex, Copilot, OpenCode, and Pi through the same interface. Pick the right model for each job.
- **Voice control:** Dictate tasks or talk through problems in voice mode. Hands-free when you need it.
- **Cross-device:** iOS, Android, desktop, web, and CLI. Start work at your desk, check in from your phone, script it from the terminal.
- **Privacy-first:** Vincu doesn't have any telemetry, tracking, or forced log-ins.

## Getting Started

Vincu runs a local server called the daemon that manages your coding agents. Clients like the desktop app, mobile app, web app, and CLI connect to it.

### Prerequisites

You need at least one agent CLI installed and configured with your credentials:

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex](https://github.com/openai/codex)
- [GitHub Copilot](https://github.com/features/copilot/cli/)
- [OpenCode](https://github.com/anomalyco/opencode)
- [Pi](https://pi.dev)

### Desktop app (recommended)

Download it from [vincu.sh/download](https://vincu.sh/download) or the [GitHub releases page](https://github.com/getvincu/vincu/releases). Open the app and the daemon starts automatically. Nothing else to install.

To connect from your phone, open **Settings → your host → Pair Device**.

### CLI / headless

Install the CLI and start Vincu:

```bash
npm install -g @getvincu/cli
vincu
```

Vincu starts locally, then asks whether to enable the end-to-end encrypted relay for device pairing. If you decline, connect directly over TCP, Tailscale, or another VPN. This path is useful for servers and remote machines.

For full setup and configuration, see:

- [Docs](https://vincu.sh/docs)
- [Connectivity guide](https://vincu.sh/docs/connectivity)
- [Configuration reference](https://vincu.sh/docs/configuration)

### Docker

Run the Vincu daemon and self-hosted web UI in Docker:

```bash
docker run -d --name vincu \
  -p 6767:6767 \
  -e VINCU_PASSWORD=change-me \
  -v "$PWD/vincu-home:/home/vincu" \
  -v "$PWD:/workspace" \
  ghcr.io/getvincu/vincu:latest
```

Open `http://localhost:6767` after it starts. Extend the base image with the agent CLIs you use, then provide credentials through environment variables or the persistent `/home/vincu` volume. See the [Docker documentation](docs/docker.md) for full setup details.

## CLI

Everything you can do in the app, you can do from the terminal.

```bash
vincu run --provider claude/opus-4.6 "implement user authentication"
vincu run --provider codex/gpt-5.4 --worktree feature-x "implement feature X"

vincu ls                           # list running agents
vincu attach abc123                # stream live output
vincu send abc123 "also add tests" # follow-up task

# run on a remote daemon
vincu --host workstation.local:6767 run "run the full test suite"
```

See the [full CLI reference](https://vincu.sh/docs/cli) for more.

## Skills

Skills teach your agent to use Vincu to orchestrate other agents.

```bash
npx skills add getvincu/vincu
```

Then use them in any agent conversation:

- `/vincu-handoff` — hand off work between agents. I use this to plan with Claude and then handoff to Codex to implement.
- `/vincu-loop` — loop an agent against clear acceptance criteria (aka Ralph loops), optionally with a verifier.
- `/vincu-advisor` — spin up a single agent as an advisor for a second opinion, without delegating the work itself.
- `/vincu-committee` — form a committee of two contrasting agents to step back, do root cause analysis, and produce a plan.

## Development

Quick monorepo package map:

- `packages/server`: Vincu daemon (agent process orchestration, WebSocket API, MCP server)
- `packages/app`: Expo client (iOS, Android, web)
- `packages/cli`: `vincu` CLI for daemon and agent workflows
- `packages/desktop`: Electron desktop app
- `packages/relay`: Relay transport and encryption used by the daemon and clients
- `packages/website`: Marketing site and documentation (`vincu.sh`)

Common commands:

```bash
# run all local dev services
npm run dev

# run individual surfaces
npm run dev:server
npm run dev:app
npm run dev:desktop
npm run dev:website

# build the server stack
npm run build:server

# repo-wide checks
npm run typecheck
```

## Related projects

- [getvincu/vincu-relay](https://github.com/getvincu/vincu-relay) — official distributed relay, written in Elixir
- [vincu-skins](https://github.com/huangguang1999/vincu-skins) — community themes and a zero-patch desktop theme loader with an Agent Skill
- [vincu-vscode](https://marketplace.visualstudio.com/items?itemName=hinnes.vincu-vscode) — VS Code extension

## License

AGPL-3.0
