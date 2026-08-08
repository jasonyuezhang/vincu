#!/usr/bin/env npx tsx

import assert from "node:assert";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "zx";
import { getAvailablePort } from "./helpers/network.ts";

$.verbose = false;

console.log("=== Onboarding Command ===\n");

const vincuHome = await mkdtemp(join(tmpdir(), "vincu-onboard-home-"));
const port = await getAvailablePort();

try {
  console.log("Test 1: `vincu` runs blocking onboarding without implicit relay pairing");
  const onboard =
    await $`VINCU_HOME=${vincuHome} VINCU_LISTEN=127.0.0.1:${port} VINCU_PAIRING_QR=0 npx vincu`.nothrow();

  assert.strictEqual(
    onboard.exitCode,
    0,
    `onboard should succeed:\nstdout:\n${onboard.stdout}\nstderr:\n${onboard.stderr}`,
  );
  assert(!onboard.stdout.includes("Scan to pair"), "onboard output should not include scan header");
  assert(!onboard.stdout.includes("#offer="), "onboard output should not include a pairing offer");
  assert(
    onboard.stdout.includes("Daemon is running with relay off"),
    "onboard output should explain the direct connection path",
  );
  assert(
    onboard.stdout.includes("CLI quick reference"),
    "onboard output should include CLI quick reference",
  );
  assert(onboard.stdout.includes("vincu --help"), "onboard output should include --help shortcut");
  assert(onboard.stdout.includes("vincu ls"), "onboard output should include ls shortcut");
  assert(
    onboard.stdout.includes('vincu run "your prompt"'),
    "onboard output should include run shortcut",
  );
  assert(onboard.stdout.includes("vincu status"), "onboard output should include status shortcut");
  assert(
    onboard.stdout.includes(join(vincuHome, "daemon.log")),
    "onboard output should include daemon log path",
  );

  const status =
    await $`VINCU_HOME=${vincuHome} npx vincu daemon status --home ${vincuHome}`.nothrow();
  assert.strictEqual(status.exitCode, 0, `daemon status should succeed: ${status.stderr}`);
  assert(status.stdout.includes("running"), "daemon should be running when onboarding exits");
  console.log("✓ onboarding keeps relay disabled and waits for daemon readiness\n");

  console.log("Test 2: --no-relay suppresses pairing for an already-running daemon");
  const enableRelay =
    await $`VINCU_HOME=${vincuHome} npx vincu daemon pair --home ${vincuHome} --relay`.nothrow();
  assert.strictEqual(enableRelay.exitCode, 0, `relay enable should succeed: ${enableRelay.stderr}`);
  assert(enableRelay.stdout.includes("#offer="), "relay enable should produce a pairing offer");

  const noRelayOnboard =
    await $`VINCU_HOME=${vincuHome} VINCU_LISTEN=127.0.0.1:${port} npx vincu --no-relay`.nothrow();
  assert.strictEqual(
    noRelayOnboard.exitCode,
    0,
    `--no-relay onboarding should succeed: ${noRelayOnboard.stderr}`,
  );
  assert(
    !noRelayOnboard.stdout.includes("#offer="),
    "--no-relay onboarding should not include a pairing offer",
  );
  console.log("✓ --no-relay suppresses pairing for an already-running daemon\n");

  console.log("Test 3: non-interactive onboarding persists voice disabled config");
  const configRaw = await readFile(join(vincuHome, "config.json"), "utf-8");
  const config = JSON.parse(configRaw) as {
    features?: {
      dictation?: { enabled?: boolean };
      voiceMode?: { enabled?: boolean };
    };
  };

  assert.strictEqual(
    config.features?.dictation?.enabled,
    false,
    "dictation.enabled should be false",
  );
  assert.strictEqual(
    config.features?.voiceMode?.enabled,
    false,
    "voiceMode.enabled should be false",
  );
  const daemonLog = await readFile(join(vincuHome, "daemon.log"), "utf-8");
  assert(
    !daemonLog.includes("Ensuring local speech models"),
    "daemon should not attempt local speech model setup when voice is disabled",
  );
  console.log("✓ non-interactive run persisted voice disabled choices\n");
} finally {
  await $`VINCU_HOME=${vincuHome} npx vincu daemon stop --home ${vincuHome} --force`.nothrow();
  await rm(vincuHome, { recursive: true, force: true });
}

console.log("=== Onboarding tests passed ===");
