#!/usr/bin/env npx tsx

import assert from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getDaemonHost,
  normalizeDaemonHost,
  resolveDaemonPassword,
  resolveDaemonTarget,
  resolveDefaultDaemonHosts,
} from "../src/utils/client.js";
import { resolveCliVersion } from "../src/version.js";

console.log("=== CLI IPC Target Helpers ===\n");

{
  console.log("Test 1: unix hosts resolve to ws+unix URLs");
  const target = resolveDaemonTarget("unix:///tmp/vincu.sock");
  assert.deepStrictEqual(target, {
    type: "ipc",
    url: "ws+unix:///tmp/vincu.sock:/ws",
    socketPath: "/tmp/vincu.sock",
  });
  console.log("✓ unix hosts resolve to ws+unix URLs\n");
}

{
  console.log("Test 1b: bare unix socket paths resolve at the connection boundary");
  const target = resolveDaemonTarget("/tmp/vincu.sock");
  assert.deepStrictEqual(target, {
    type: "ipc",
    url: "ws+unix:///tmp/vincu.sock:/ws",
    socketPath: "/tmp/vincu.sock",
  });
  console.log("✓ bare unix socket paths resolve at the connection boundary\n");
}

{
  console.log("Test 2: pipe hosts preserve the Node socketPath transport form");
  const target = resolveDaemonTarget("pipe://\\\\.\\pipe\\vincu-managed-test");
  assert.deepStrictEqual(target, {
    type: "ipc",
    url: "ws://localhost/ws",
    socketPath: "\\\\.\\pipe\\vincu-managed-test",
  });
  console.log("✓ pipe hosts preserve Node socketPath transport form\n");
}

{
  console.log("Test 3: tcp URI host targets honor ssl=true");
  const target = resolveDaemonTarget("tcp://example.com:6767?ssl=true&password=query-secret");
  assert.deepStrictEqual(target, {
    type: "tcp",
    url: "wss://example.com:6767/ws",
  });
  console.log("✓ tcp URI host targets honor ssl=true\n");
}

{
  console.log("Test 4: tcp URI hosts normalize into canonical direct TCP targets");
  assert.strictEqual(
    normalizeDaemonHost("tcp://Example.com:6767?ssl=true&password=query-secret"),
    "tcp://Example.com:6767?ssl=true&password=query-secret",
  );
  console.log("✓ tcp URI hosts normalize into canonical direct TCP targets\n");
}

{
  console.log("Test 5: local unix socket paths normalize into IPC daemon targets");
  assert.strictEqual(normalizeDaemonHost("/tmp/vincu.sock"), "unix:///tmp/vincu.sock");
  console.log("✓ local unix socket paths normalize into IPC daemon targets\n");
}

{
  console.log("Test 5b: Windows absolute paths are NOT treated as unix sockets");
  assert.strictEqual(normalizeDaemonHost("C:\\Users\\foo\\.vincu\\vincu.sock"), null);
  assert.strictEqual(normalizeDaemonHost("D:\\project\\socket"), null);
  console.log("✓ Windows absolute paths are not treated as unix sockets\n");
}

{
  console.log("Test 6: default host resolution tries local IPC first, then localhost fallback");
  const vincuHome = mkdtempSync(path.join(os.tmpdir(), "vincu-client-targets-"));
  try {
    mkdirSync(vincuHome, { recursive: true });
    writeFileSync(
      path.join(vincuHome, "vincu.pid"),
      JSON.stringify({ pid: process.pid, listen: "/tmp/vincu-from-pid.sock" }),
    );
    assert.deepStrictEqual(resolveDefaultDaemonHosts({ VINCU_HOME: vincuHome }), [
      "unix:///tmp/vincu-from-pid.sock",
      "localhost:6767",
    ]);
    const previousHome = process.env.VINCU_HOME;
    const previousHost = process.env.VINCU_HOST;
    process.env.VINCU_HOME = vincuHome;
    delete process.env.VINCU_HOST;
    assert.strictEqual(getDaemonHost(), "unix:///tmp/vincu-from-pid.sock");
    if (previousHome === undefined) delete process.env.VINCU_HOME;
    else process.env.VINCU_HOME = previousHome;
    if (previousHost === undefined) delete process.env.VINCU_HOST;
    else process.env.VINCU_HOST = previousHost;
  } finally {
    rmSync(vincuHome, { recursive: true, force: true });
  }
  console.log("✓ default host resolution tries local IPC first, then localhost fallback\n");
}

{
  console.log("Test 7: configured TCP host is preserved before the localhost fallback");
  const vincuHome = mkdtempSync(path.join(os.tmpdir(), "vincu-client-targets-tcp-"));
  try {
    assert.deepStrictEqual(
      resolveDefaultDaemonHosts({
        VINCU_HOME: vincuHome,
        VINCU_LISTEN: "127.0.0.1:7777",
      }),
      ["127.0.0.1:7777", "localhost:6767"],
    );
  } finally {
    rmSync(vincuHome, { recursive: true, force: true });
  }
  console.log("✓ configured TCP host is preserved before the localhost fallback\n");
}

{
  console.log("Test 8: CLI app version resolves for daemon hello compatibility");
  assert.match(resolveCliVersion(), /^\d+\.\d+\.\d+/);
  console.log("✓ CLI app version resolves for daemon hello compatibility\n");
}

{
  console.log("Test 9: local IPC still takes priority over configured TCP hosts");
  const vincuHome = mkdtempSync(path.join(os.tmpdir(), "vincu-client-targets-order-"));
  try {
    mkdirSync(vincuHome, { recursive: true });
    writeFileSync(
      path.join(vincuHome, "vincu.pid"),
      JSON.stringify({ pid: process.pid, listen: "/tmp/vincu-priority.sock" }),
    );
    assert.deepStrictEqual(
      resolveDefaultDaemonHosts({
        VINCU_HOME: vincuHome,
        VINCU_LISTEN: "127.0.0.1:7777",
      }),
      ["unix:///tmp/vincu-priority.sock", "127.0.0.1:7777", "localhost:6767"],
    );
  } finally {
    rmSync(vincuHome, { recursive: true, force: true });
  }
  console.log("✓ local IPC still takes priority over configured TCP hosts\n");
}

{
  console.log("Test 10: daemon password resolution prefers TCP URI query, falls back to env");
  const previousEnv = process.env.VINCU_PASSWORD;
  try {
    delete process.env.VINCU_PASSWORD;
    assert.strictEqual(
      resolveDaemonPassword("tcp://example.com:6767?ssl=true&password=query-secret"),
      "query-secret",
    );
    assert.strictEqual(resolveDaemonPassword("tcp://missing.example:6767"), undefined);
    assert.strictEqual(resolveDaemonPassword("example.com:6767"), undefined);

    process.env.VINCU_PASSWORD = "env-secret";
    assert.strictEqual(
      resolveDaemonPassword("tcp://example.com:6767?ssl=true&password=query-secret"),
      "query-secret",
      "URI password should take precedence over env var",
    );
    assert.strictEqual(
      resolveDaemonPassword("tcp://missing.example:6767"),
      "env-secret",
      "TCP host without query password should fall back to env var",
    );
    assert.strictEqual(
      resolveDaemonPassword("example.com:6767"),
      "env-secret",
      "Bare host should pick up env var password",
    );
    assert.strictEqual(resolveDaemonPassword("localhost:6767"), "env-secret");

    process.env.VINCU_PASSWORD = "";
    assert.strictEqual(
      resolveDaemonPassword("localhost:6767"),
      undefined,
      "Empty env var should be treated as unset",
    );
  } finally {
    if (previousEnv === undefined) {
      delete process.env.VINCU_PASSWORD;
    } else {
      process.env.VINCU_PASSWORD = previousEnv;
    }
  }
  console.log("✓ daemon password resolution prefers TCP URI query, falls back to env\n");
}

console.log("=== All CLI IPC target tests passed ===");
