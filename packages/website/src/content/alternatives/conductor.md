---
title: Open Source Conductor Alternative With Linux, Windows, and Mobile
description: Vincu is open source, runs on macOS, Linux, and Windows, ships native iOS and Android apps, and supports 30+ agents through the in-app catalog plus any ACP or CLI agent. Conductor is macOS only and Claude Code or Codex only.
nav: Conductor
order: 50
---

# Vincu vs Conductor

Conductor is a macOS app for running Claude Code and Codex in parallel git worktrees. Closed source.

Vincu is an app for orchestrating coding agents, with native clients on desktop, mobile, web, and the CLI. Open source (AGPL-3.0).

![Vincu desktop and mobile app](/hero-mockup.png)

## Why pick Vincu

Conductor runs on macOS, with Claude Code and Codex, in parallel git worktrees. Vincu does all of that. Pick Vincu if you want:

- Linux or Windows alongside macOS
- A native iOS and Android app
- Many more agents than Claude Code and Codex
- A CLI to script agent work and drive remote daemons
- A self-hosted daemon you can run on a server, VM, or homelab
- Open source you can audit and fork

## Architecture

The Vincu daemon runs as its own process. Desktop, web, mobile, and CLI all connect to it over a websocket. Run the daemon on your laptop, on a VM, in Docker, or across a fleet, and connect to any of them from any client.

Conductor's desktop app is the host. Agents run inside it.

## Providers

Vincu runs Claude Code, Codex, OpenCode, and Pi natively, plus 30+ more agents through the in-app catalog including GitHub Copilot, Cursor, Gemini CLI, and Amp. Vincu speaks the [Agent Client Protocol](https://agentclientprotocol.com), so any ACP agent works. Custom providers run any CLI agent. See [Supported providers](/docs/supported-providers).

Conductor runs Claude Code and Codex.

Both tools launch the official CLIs as subprocesses with your own credentials. Neither extracts tokens or proxies model calls.

## Panes

Vincu's app has split panes and tabs (⌘D for vertical, ⌘⇧D for horizontal). Panes include a terminal alongside your agents, a diff viewer, and a browser for testing running services.

## GitHub

Vincu's app handles commit, push, opening PRs, watching checks and reviews, and merging.

## CLI

Vincu has a CLI that mirrors the app:

```bash
vincu run --provider codex "implement OAuth"
vincu run --host devbox:6767 "run the test suite"
vincu ls
vincu send <agent-id> "add tests"
vincu schedule create --cron "0 9 * * 1" "audit the codebase"
```

`vincu run --host` connects to a remote daemon. `vincu schedule` runs an agent on a cron. `vincu loop` retries an agent until a verification command passes.

Conductor does not have a CLI.

## Worktrees and services

Both tools isolate parallel agents in git worktrees.

Vincu also gives each worktree its own dev server URL. Two agents running their dev servers at the same time get `web.fix-auth.my-app.localhost` and `web.add-search.my-app.localhost` instead of port collisions.

## Mobile

Vincu ships native iOS and Android apps with the same feature set as the desktop app. Conductor has no mobile app.

## Voice

Vincu's speech-to-text and text-to-speech run locally on your device. Nothing leaves your network. Conductor does not have voice.

## Comparison

|                              | Vincu                                                           | Conductor          |
| ---------------------------- | --------------------------------------------------------------- | ------------------ |
| License                      | Open source (AGPL-3.0)                                          | Closed source      |
| Platforms                    | macOS, Linux, Windows                                           | macOS only         |
| Native mobile                | iOS, Android                                                    | —                  |
| Providers                    | Claude Code, Codex, OpenCode, Pi + 30+ via ACP catalog + custom | Claude Code, Codex |
| Git worktrees                | Yes                                                             | Yes                |
| Per-worktree dev server URLs | Yes                                                             | —                  |
| Split panes and tabs         | Yes                                                             | —                  |
| In-app terminal              | Yes                                                             | Yes                |
| In-app browser               | Yes                                                             | —                  |
| GitHub workflow in app       | Commit, push, PR, checks, reviews, merge                        | Yes                |
| CLI                          | Run, `--host`, ls, send, schedule, loop                         | —                  |
| Local voice (on-device)      | Yes                                                             | —                  |
| Self-hosted daemon           | Yes                                                             | —                  |

See also: [Vincu vs Superset](/alternatives/superset), [Vincu vs OpenChamber](/alternatives/openchamber), [Vincu vs Happy Coder](/alternatives/happy-coder).
