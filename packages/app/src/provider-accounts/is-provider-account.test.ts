import { describe, expect, test } from "vitest";

import {
  isProviderAccountId,
  nextDefaultProviderAccountLabel,
  providerAccountCompanyName,
  resolveProviderAccountBase,
} from "./is-provider-account";

describe("isProviderAccountId", () => {
  test("detects VINCU_PROVIDER_ACCOUNT sentinel on provider env", () => {
    expect(
      isProviderAccountId(
        {
          providers: {
            "claude-personal": {
              extends: "claude",
              env: { VINCU_PROVIDER_ACCOUNT: "1" },
            },
          },
        } as never,
        "claude-personal",
      ),
    ).toBe(true);
    expect(
      isProviderAccountId(
        {
          providers: {
            "claude-work": {
              extends: "claude",
              env: { ANTHROPIC_API_KEY: "sk-test" },
            },
          },
        } as never,
        "claude-work",
      ),
    ).toBe(false);
  });
});

describe("resolveProviderAccountBase", () => {
  test("returns the company base for oauth account providers", () => {
    expect(
      resolveProviderAccountBase(
        {
          providers: {
            "codex-work": {
              extends: "codex",
              env: { VINCU_PROVIDER_ACCOUNT: "1", CODEX_HOME: "/tmp/home" },
            },
          },
        } as never,
        "codex-work",
      ),
    ).toBe("codex");
    expect(providerAccountCompanyName("codex")).toBe("Codex");
    expect(providerAccountCompanyName("claude")).toBe("Claude");
  });
});

describe("nextDefaultProviderAccountLabel", () => {
  test("increments default labels per base", () => {
    expect(nextDefaultProviderAccountLabel("claude", { providers: {} } as never)).toBe(
      "Claude account",
    );
    expect(
      nextDefaultProviderAccountLabel("claude", {
        providers: {
          "claude-account": {
            extends: "claude",
            env: { VINCU_PROVIDER_ACCOUNT: "1" },
          },
        },
      } as never),
    ).toBe("Claude account 2");
    expect(nextDefaultProviderAccountLabel("codex", { providers: {} } as never)).toBe(
      "Codex account",
    );
  });
});
