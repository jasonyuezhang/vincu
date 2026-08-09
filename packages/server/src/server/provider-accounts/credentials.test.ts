import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { hasProviderAccountCredentials, isProviderAccountReadyForEnable } from "./credentials.js";

describe("provider account credentials", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("oauth accounts are not ready until credential files exist", () => {
    const home = mkdtempSync(path.join(tmpdir(), "vincu-account-creds-"));
    tempDirs.push(home);

    expect(
      isProviderAccountReadyForEnable({
        extends: "codex",
        env: { VINCU_PROVIDER_ACCOUNT: "1", CODEX_HOME: home },
      }),
    ).toBe(false);

    writeFileSync(path.join(home, "auth.json"), "{}");
    expect(hasProviderAccountCredentials("codex", home)).toBe(true);
    expect(
      isProviderAccountReadyForEnable({
        extends: "codex",
        env: { VINCU_PROVIDER_ACCOUNT: "1", CODEX_HOME: home },
      }),
    ).toBe(true);
  });

  test("non-account overrides are always ready for enable", () => {
    expect(
      isProviderAccountReadyForEnable({
        extends: "claude",
        env: { ANTHROPIC_API_KEY: "sk-test" },
      }),
    ).toBe(true);
  });

  test("cursor oauth accounts require cli-config authInfo", () => {
    const home = mkdtempSync(path.join(tmpdir(), "vincu-cursor-creds-"));
    tempDirs.push(home);

    expect(
      isProviderAccountReadyForEnable({
        extends: "cursor",
        env: { VINCU_PROVIDER_ACCOUNT: "1", CURSOR_CONFIG_DIR: home },
      }),
    ).toBe(false);

    writeFileSync(
      path.join(home, "cli-config.json"),
      JSON.stringify({ authInfo: { userId: "1" } }),
    );
    expect(hasProviderAccountCredentials("cursor", home)).toBe(true);
    expect(
      isProviderAccountReadyForEnable({
        extends: "cursor",
        env: { VINCU_PROVIDER_ACCOUNT: "1", CURSOR_CONFIG_DIR: home },
      }),
    ).toBe(true);
  });
});
