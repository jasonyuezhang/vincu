import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  resolveClaudeConfigDirFromRuntime,
  resolveCodexHomeDirFromRuntime,
} from "./resolve-home.js";

describe("provider account home resolvers", () => {
  const previousClaude = process.env.CLAUDE_CONFIG_DIR;
  const previousCodex = process.env.CODEX_HOME;

  afterEach(() => {
    if (previousClaude === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = previousClaude;
    }
    if (previousCodex === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodex;
    }
  });

  test("prefers runtimeSettings env over process env and defaults", () => {
    process.env.CLAUDE_CONFIG_DIR = "/from/process/claude";
    process.env.CODEX_HOME = "/from/process/codex";
    expect(
      resolveClaudeConfigDirFromRuntime({
        env: { CLAUDE_CONFIG_DIR: "/from/runtime/claude" },
      }),
    ).toBe("/from/runtime/claude");
    expect(
      resolveCodexHomeDirFromRuntime({
        env: { CODEX_HOME: "/from/runtime/codex" },
      }),
    ).toBe("/from/runtime/codex");
  });

  test("falls back to process env then default homes", () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CODEX_HOME;
    expect(resolveClaudeConfigDirFromRuntime()).toBe(path.join(os.homedir(), ".claude"));
    expect(resolveCodexHomeDirFromRuntime()).toBe(path.join(os.homedir(), ".codex"));

    process.env.CLAUDE_CONFIG_DIR = "/from/process/claude";
    process.env.CODEX_HOME = "/from/process/codex";
    expect(resolveClaudeConfigDirFromRuntime()).toBe("/from/process/claude");
    expect(resolveCodexHomeDirFromRuntime()).toBe("/from/process/codex");
  });
});
