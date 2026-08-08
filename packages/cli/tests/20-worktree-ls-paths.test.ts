#!/usr/bin/env npx tsx

import assert from "node:assert";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveVincuHomePath, resolveVincuWorktreesDir } from "../src/commands/worktree/ls.js";

console.log("=== Worktree LS Path Helper Tests ===\n");

const originalVincuHome = process.env.VINCU_HOME;

try {
  {
    console.log("Test 1: resolves explicit VINCU_HOME when set");
    process.env.VINCU_HOME = "/tmp/vincu-explicit-home";

    assert.strictEqual(resolveVincuHomePath(), "/tmp/vincu-explicit-home");
    assert.strictEqual(resolveVincuWorktreesDir(), "/tmp/vincu-explicit-home/worktrees");
    console.log("\u2713 explicit VINCU_HOME is respected\n");
  }

  {
    console.log("Test 2: falls back to homedir/.vincu when VINCU_HOME is unset");
    delete process.env.VINCU_HOME;

    assert.strictEqual(resolveVincuHomePath(), join(homedir(), ".vincu"));
    assert.strictEqual(resolveVincuWorktreesDir(), join(homedir(), ".vincu", "worktrees"));
    console.log("\u2713 fallback home path is derived from os.homedir()\n");
  }
} finally {
  if (originalVincuHome === undefined) {
    delete process.env.VINCU_HOME;
  } else {
    process.env.VINCU_HOME = originalVincuHome;
  }
}

console.log("=== All worktree ls path helper tests passed ===");
