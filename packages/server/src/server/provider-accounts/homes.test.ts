import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  allocateProviderAccountId,
  buildProviderAccountEnv,
  isProviderAccountOverride,
  providerAccountHomePath,
  resolveProviderAccountHome,
  slugifyProviderAccountLabel,
} from "./homes.js";

describe("provider account homes", () => {
  test("builds isolated env for claude and codex", () => {
    expect(buildProviderAccountEnv("claude", "/tmp/home/claude-personal")).toEqual({
      VINCU_PROVIDER_ACCOUNT: "1",
      CLAUDE_CONFIG_DIR: "/tmp/home/claude-personal",
    });
    expect(buildProviderAccountEnv("codex", "/tmp/home/codex-work")).toEqual({
      VINCU_PROVIDER_ACCOUNT: "1",
      CODEX_HOME: "/tmp/home/codex-work",
    });
  });

  test("detects account overrides via sentinel and home path", () => {
    const vincuHome = "/Users/me/.vincu";
    const home = providerAccountHomePath(vincuHome, "claude-personal");
    expect(
      isProviderAccountOverride(
        {
          extends: "claude",
          env: { VINCU_PROVIDER_ACCOUNT: "1", CLAUDE_CONFIG_DIR: home },
        },
        vincuHome,
      ),
    ).toBe(true);
    expect(
      isProviderAccountOverride(
        {
          extends: "claude",
          env: { CLAUDE_CONFIG_DIR: home },
        },
        vincuHome,
      ),
    ).toBe(true);
    expect(
      isProviderAccountOverride(
        {
          extends: "claude",
          env: { ANTHROPIC_API_KEY: "sk-test" },
        },
        vincuHome,
      ),
    ).toBe(false);
  });

  test("falls back to provider-accounts home when mutable env lost the path", () => {
    const vincuHome = "/Users/me/.vincu";
    expect(
      resolveProviderAccountHome(
        {
          extends: "codex",
          env: { VINCU_PROVIDER_ACCOUNT: "1" },
        },
        "codex",
        { vincuHome, providerId: "codex-codex-account" },
      ),
    ).toBe(providerAccountHomePath(vincuHome, "codex-codex-account"));
  });

  test("allocates stable unique provider ids from labels", () => {
    expect(slugifyProviderAccountLabel("Claude (Work)")).toBe("claude-work");
    expect(
      allocateProviderAccountId({
        base: "claude",
        label: "Personal",
        existingIds: new Set(),
      }),
    ).toBe("claude-personal");
    expect(
      allocateProviderAccountId({
        base: "claude",
        label: "Personal",
        existingIds: new Set(["claude-personal"]),
      }),
    ).toBe("claude-personal-2");
    expect(providerAccountHomePath("/tmp/.vincu", "codex-work")).toBe(
      path.join("/tmp/.vincu", "provider-accounts", "codex-work"),
    );
  });
});
