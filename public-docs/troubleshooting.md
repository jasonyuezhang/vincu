---
title: Troubleshooting
description: Why Vincu can't find a provider you've installed, and how to fix the PATH and environment mismatches behind most setup issues.
nav: Common problems
order: 90
category: Troubleshooting
---

# Troubleshooting

Almost every "it works in my terminal but not in Vincu" problem is the same thing: Vincu and your terminal aren't searching the same `PATH`. This page covers how to spot that and fix it.

## Vincu can't find my provider

A provider you've installed shows as **Not installed**.

Vincu launches the agent CLIs you've already installed, it doesn't bundle them (see [Providers](/docs/providers)). So it has to find the command on its own `PATH`. If your shell only adds that location to `PATH` under certain conditions, Vincu can miss it.

### See what Vincu sees

Open **Settings → your host → Providers**, tap the provider, then tap **Diagnostic**. The rows that matter:

- **Resolved path** — where Vincu found the binary, or `not found`.
- **Daemon PATH** — the `PATH` Vincu is searching. Compare it to `echo $PATH` in a fresh terminal.
- **Version** — whether the binary actually runs.

`not found` together with a **Daemon PATH** that's missing your binary's directory is the common case: that directory is on your terminal's `PATH` but not on Vincu's.

### Fix it

The durable fix is to make sure the command is on `PATH` for a normal login shell, then restart Vincu, see [why Vincu's environment can differ](#why-vincus-environment-can-differ-from-your-terminal) for why that's the test that matters.

If you'd rather pin it directly, set the binary path in `~/.vincu/config.json`:

```json
{
  "agents": {
    "providers": {
      "claude": {
        "command": ["/absolute/path/to/claude"]
      }
    }
  }
}
```

`command` is `[binary, ...args]` and fully replaces the default launch command for that provider. Find the real path with `which -a claude`. `type -a claude` also tells you if `claude` is only a shell alias or function, those won't work, Vincu runs the binary directly, so use the path it points to. Restart the daemon after editing (see [below](#i-changed-configjson-but-nothing-happened)).

For alternative endpoints, multiple profiles, custom binaries, and ACP agents, see [Custom providers](/docs/custom-providers). For per-agent install links, see [Supported providers](/docs/supported-providers).

## Why Vincu's environment can differ from your terminal

The same mismatch shows up anywhere Vincu runs your tools, an agent, or a terminal, reporting `command not found` for something you use every day.

When you open the **desktop app** from the Dock or Finder, the OS hands it a stripped-down environment, not your terminal's `PATH`. To compensate, Vincu runs your login shell once at startup (`$SHELL -i -l -c`), captures its environment, and hands that to the daemon and everything it spawns. The rule of thumb: **if a brand-new terminal can run the command, Vincu should too.** That's also the test, open a fresh terminal and try it there.

When you start the daemon yourself from a terminal (`vincu`), there's no login-shell step, it simply inherits that terminal's environment.

Either way, the fix for a missing tool lives in your shell config (`.zshrc`, `.zprofile`, …), not in Vincu. Tools installed through version managers (asdf, mise, nvm, …) are the usual offenders, make sure they initialize for a clean login shell, not only inside one you've already opened.

This login-shell step runs on macOS and Linux. On Windows, Vincu uses the environment it was launched with.

## Reading the logs

- **Desktop app** — the login-shell resolution is logged here. Look for `[login-shell-env]`: `applied` means it worked (it logs the `PATH` before and after); `failed; keeping inherited env` means it fell back to the stripped-down environment, with a `reason` (a timeout, a non-zero exit from your shell config, no output, …). A slow or erroring `.zshrc`/`.zprofile` is the usual cause.
- **Daemon** — `~/.vincu/daemon.log` (`$VINCU_HOME/daemon.log` if you've set a custom home).

Desktop app log location:

| Platform | Path                            |
| -------- | ------------------------------- |
| macOS    | `~/Library/Logs/Vincu/main.log` |
| Linux    | `~/.config/Vincu/logs/main.log` |
| Windows  | `%APPDATA%\Vincu\logs\main.log` |

## I changed config.json but nothing happened

`config.json` is read when the daemon starts. Restart it after editing:

```bash
vincu daemon restart
```

Or in the app, open **Settings → your host → Overview** and use **Restart daemon**. Running agents keep going, and clients reconnect automatically.

## Still stuck?

- [Custom providers](/docs/custom-providers) — endpoints, profiles, binaries, ACP agents.
- [Configuration](/docs/configuration) — `config.json`, environment variables, logging.
- [How Vincu resolves your login shell](https://github.com/getvincu/vincu/blob/main/packages/desktop/src/login-shell-env.ts) — the exact code that loads your shell environment.
- [Report an issue](https://github.com/getvincu/vincu/issues).
