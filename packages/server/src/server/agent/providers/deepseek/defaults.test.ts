import { describe, expect, test } from "vitest";

import {
  DEEPSEEK_ANTHROPIC_BASE_URL,
  DEEPSEEK_V4_MODELS,
  mergeDeepSeekDefaults,
  resolveDeepSeekApiKey,
} from "./defaults.js";

describe("mergeDeepSeekDefaults", () => {
  test("bakes Anthropic-compatible endpoint, auth mapping, and WebSearch disallow", () => {
    const merged = mergeDeepSeekDefaults(
      {
        env: { DEEPSEEK_API_KEY: "sk-deepseek-test" },
      },
      {},
    );

    expect(merged.env?.ANTHROPIC_BASE_URL).toBe(DEEPSEEK_ANTHROPIC_BASE_URL);
    expect(merged.env?.ANTHROPIC_AUTH_TOKEN).toBe("sk-deepseek-test");
    expect(merged.disallowedTools).toEqual(["WebSearch"]);
  });

  test("caller env wins for base URL and preserves existing disallowed tools", () => {
    const merged = mergeDeepSeekDefaults(
      {
        env: {
          ANTHROPIC_BASE_URL: "https://proxy.example/anthropic",
          ANTHROPIC_AUTH_TOKEN: "sk-override",
        },
        disallowedTools: ["WebFetch"],
      },
      { DEEPSEEK_API_KEY: "sk-ignored" },
    );

    expect(merged.env?.ANTHROPIC_BASE_URL).toBe("https://proxy.example/anthropic");
    expect(merged.env?.ANTHROPIC_AUTH_TOKEN).toBe("sk-override");
    expect(merged.disallowedTools).toEqual(["WebFetch", "WebSearch"]);
  });

  test("resolves API key from host process env when override omits it", () => {
    expect(
      resolveDeepSeekApiKey(undefined, {
        DEEPSEEK_API_KEY: "sk-from-host",
      }),
    ).toBe("sk-from-host");
  });

  test("ships V4 pro as the default model", () => {
    expect(DEEPSEEK_V4_MODELS.find((model) => model.isDefault)?.id).toBe("deepseek-v4-pro");
    expect(DEEPSEEK_V4_MODELS.map((model) => model.id)).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ]);
  });
});
