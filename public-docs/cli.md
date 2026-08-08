---
title: CLI
description: "Vincu CLI reference: manage agents, workspaces, scripts, schedules, daemons, and permissions from your terminal."
nav: CLI
order: 3
category: Getting started
---

# CLI

The Vincu CLI lets you manage agents from your terminal. It's the same interface exposed by the daemon's API, so anything you can do in the app you can do from the command line.

> **Agent orchestration:** You can tell coding agents to use the Vincu CLI to spawn and manage other agents. Vincu recognizes the calling agent, so CLI-created workers get the same workspace and parent defaults as MCP-created workers.

## Quick reference

```bash
vincu run "fix the tests"            # Start an agent
vincu ls                             # List running agents
vincu attach <id>                    # Stream agent output
vincu send <id> "also fix linting"   # Send follow-up task
vincu logs <id>                      # View agent timeline
vincu stop <id>                      # Stop an agent
```

## Running agents

Use `vincu run` to start a new agent with a task:

```bash
vincu run "implement user authentication"
vincu run --provider codex "refactor the API layer"
vincu run --background "run the focused test suite"
vincu run --new-workspace worktree --worktree-mode branch-off --new-branch feature/x --base main "implement feature X"
vincu run --workspace <workspace-id> "review the current diff"
vincu run --output-schema schema.json "extract release notes"
vincu run --output-schema '{"type":"object","properties":{"summary":{"type":"string"}},"required":["summary"]}' "summarize release notes"
```

From a human shell, a bare `vincu run` creates a new local workspace for the current directory. Use `--workspace <id>` to add the agent to an existing workspace, or `--new-workspace local|worktree` to explicitly create a separate workspace for the run.

Worktree creation accepts `--worktree-mode branch-off|checkout-branch|checkout-pr` plus the matching `--new-branch`/`--base`, `--branch`, or `--pr-number`/`--forge` options. Use `--worktree-slug` to choose the managed directory slug.

When an existing Vincu agent runs the same command, Vincu recognizes it through `VINCU_AGENT_ID`. Without explicit placement, the new agent becomes its subagent in the same workspace. `--workspace` can place that subagent elsewhere without changing its parent.

Use `--output-schema` to return only matching JSON output. You can pass a schema file path or an inline JSON schema object. This mode cannot be used with `--background`.

By default, `vincu run` waits for completion. Use `--background` to return immediately while the agent keeps running.

## Workspaces

Create a workspace independently when you want to prepare its files before starting an agent:

```bash
vincu workspace create --isolation local --path ~/dev/my-app --title main

vincu workspace create \
  --isolation worktree \
  --path ~/dev/my-app \
  --mode branch-off \
  --new-branch feature/auth \
  --worktree-slug feature-auth \
  --base main

vincu workspace create \
  --isolation worktree \
  --path ~/dev/my-app \
  --mode checkout-branch \
  --branch feature/existing \
  --worktree-slug existing-copy

vincu workspace create \
  --isolation worktree \
  --path ~/dev/my-app \
  --mode checkout-pr \
  --pr-number 2186
```

Then list, use, or archive it:

```bash
vincu workspace ls
vincu run --workspace <workspace-id> "implement authentication"
vincu workspace archive <workspace-id>
```

Add `--forge <name>` to PR checkout when Vincu cannot infer the forge from the source checkout. See [Git worktrees](/docs/worktrees) for setup hooks and services.

## Workspace scripts

List, start, and stop the scripts configured in a workspace's `vincu.json`:

```bash
vincu script ls
vincu script start web
vincu script stop web
```

By default, Vincu selects the workspace whose directory is the current directory. Pass `--cwd <path>` to select a different directory, or `--workspace <workspace-id>` when a directory has multiple workspaces. These commands also accept `--host` and the standard output options such as `--json`.

The output includes each script's lifecycle and supervised terminal ID. Services also include their assigned port, proxy URL, and health. See [Git worktrees](/docs/worktrees#scripts-and-services) for `vincu.json` configuration.

## Listing agents

```bash
vincu ls                    # Running agents in current directory
vincu ls -a                 # Include completed/stopped agents
vincu ls -g                 # All directories
vincu ls -a -g --json       # Full list as JSON
```

## Streaming output

Use `vincu attach` to stream an agent's output in real-time:

```bash
vincu attach abc123   # Attach to agent (Ctrl+C to detach)
```

Agent IDs can be shortened, `abc` works if it's unambiguous.

## Sending messages

Send follow-up tasks to a running or idle agent:

```bash
vincu send <id> "now run the tests"
vincu send <id> --image screenshot.png "what's wrong here?"
vincu send <id> --no-wait "queue this task"
```

## Viewing logs

```bash
vincu logs <id>                  # Full timeline
vincu logs <id> -f               # Follow (streaming)
vincu logs <id> --tail 10        # Last 10 entries
vincu logs <id> --filter tools   # Only tool calls
```

## Waiting for agents

Block until an agent finishes its current task:

```bash
vincu wait <id>
vincu wait <id> --timeout 60   # 60 second timeout
```

Useful in scripts or when one agent needs to wait for another.

## Schedules

Run an agent on a cron schedule. The CLI also accepts simple cadence presets and compiles them to cron. See [Schedules from the CLI](/docs/schedules-cli) for the full reference.

```bash
vincu schedule create --every 30m --cwd ~/dev/my-app "Continue the refactor and leave a note."
vincu schedule ls
vincu schedule pause <id>
```

## Permissions

Agents may request permission for certain actions. Manage these from the CLI:

```bash
vincu permit ls                # List pending requests
vincu permit allow <id>        # Allow all pending for agent
vincu permit deny <id> --all   # Deny all pending
```

## Agent modes

Change an agent's operational mode (provider-specific):

```bash
vincu agent mode <id> --list   # Show available modes
vincu agent mode <id> bypass   # Set bypass mode
vincu agent mode <id> plan     # Set plan mode
vincu agent detach <id>        # Make a subagent top-level
```

Detaching is an explicit lifecycle action, not a creation flag. The agent keeps running; only its relationship to its parent changes.

## Daemon management

```bash
vincu daemon start             # Start the daemon
vincu daemon start --web-ui    # Start and serve the bundled web UI
vincu daemon status            # Check status
vincu daemon stop              # Stop the daemon
```

Use `VINCU_HOME` to run multiple isolated daemon instances.

## Hub

```bash
vincu hub connect <url>        # Enroll this daemon with a Vincu Hub
vincu hub status               # Show the current Hub relationship
vincu hub disconnect           # End it
vincu hub deploy [file]        # Install and activate a Hub configuration
```

`file` defaults exactly to `.vincu/hub.yml` relative to the current directory. Pass a file to use another path. The CLI does not search parent directories or alternate filenames.

Pass `-p, --project <slug>` to select the project, or add optional top-level `project` metadata to the YAML. The flag wins when both are present. Project is deployment metadata, not workflow configuration, and the YAML is sent unchanged.

Prompt `include` blocks are read from `.vincu/partials/` under the current directory, even when you pass an explicit configuration file. The CLI sends only the files referenced by the main YAML. Nested include-looking text inside a partial is content and is not resolved recursively. Inline-only configurations omit the partial bundle.

Deployment requires an explicit Hub origin and organization API key. `--hub <origin>` overrides `VINCU_HUB_URL`; `--api-key <secret>` overrides `VINCU_HUB_API_KEY`. The key's organization supplies organization scope. Durable Hub login and credential persistence are not implemented.

See [Daemons in Hub](/docs/hub/daemons), [Hub configuration](/docs/hub/configuration), and the [Hub public API](/docs/hub/api).

## Connecting to a remote daemon

`--host` accepts either a local target (`host:port`, a unix socket, or a Windows pipe) or a pairing offer URL, the same `https://app.vincu.sh/#offer=...` link the mobile app uses for QR pairing. With an offer URL the CLI connects through the Vincu relay with end-to-end encryption, so you can drive a daemon on another machine without exposing it to the network.

Get an offer URL from the daemon you want to control:

```bash
vincu daemon pair          # asks before enabling relay, then prints the QR and link
vincu daemon pair --relay  # enables relay without prompting
vincu daemon pair --json   # structured output; never prompts
```

Relay is off for new installations. In non-interactive or JSON mode, a disabled relay returns a `RELAY_DISABLED` error; pass `--relay` to provide explicit consent. Relay pairing is end-to-end encrypted. See [Security](/docs/security).

Use it from anywhere:

```bash
vincu ls --host 'https://app.vincu.sh/#offer=eyJ2IjoyLC...'
vincu run --host "$OFFER_URL" "fix the failing tests"
```

You can also set it once via `VINCU_HOST` instead of passing `--host` on every command.

## Multi-agent workflows

The CLI is designed to be used by agents themselves. You can instruct an agent to spawn sub-agents for parallel work:

```bash
# Agent A spawns Agent B and waits for it
agent_id=$(vincu run --background --quiet --title api-agent "implement the API")
vincu wait "$agent_id"
vincu logs "$agent_id" --tail 5
```

Because Agent A's ID is present in the environment, Agent B is created as its subagent in the same workspace unless `--workspace` is specified.

Simple implement + verify loop:

```bash
# Requires jq
while true; do
  vincu run --provider codex "make the tests pass" >/dev/null

  verdict=$(vincu run --provider claude --output-schema '{"type":"object","properties":{"criteria_met":{"type":"boolean"}},"required":["criteria_met"],"additionalProperties":false}' "ensure tests all pass")
  if echo "$verdict" | jq -e '.criteria_met == true' >/dev/null; then
    echo "criteria met"
    break
  fi
done
```

This pattern enables hierarchical task decomposition, a lead agent can break down work, delegate to specialists, and synthesize results.

## Output formats

Most commands support multiple output formats for scripting:

```bash
vincu ls --json                # JSON output
vincu ls --format yaml         # YAML output
vincu ls -q                    # IDs only (quiet)
```

## Global options

- `--host <target>`, connect to a different daemon (`host:port`, unix socket, or `https://app.vincu.sh/#offer=...` for relay). See [Connecting to a remote daemon](#connecting-to-a-remote-daemon).
- `--json`, JSON output
- `-q, --quiet`, minimal output
- `--no-color`, disable colors
