import { describe, expect, test } from "vitest";

import {
  buildProviderAccountLoginMessage,
  parseProviderAccountLoginOutput,
  stripAnsi,
} from "./login-output.js";

describe("parseProviderAccountLoginOutput", () => {
  test("extracts Codex device-auth URL and code from ANSI output", () => {
    const output = [
      "Welcome to Codex",
      "1. Open this link in your browser and sign in to your account",
      "   \u001b[94mhttps://auth.openai.com/codex/device\u001b[0m",
      "",
      "2. Enter this one-time code \u001b[90m(expires in 15 minutes)\u001b[0m",
      "   \u001b[94mGDH4-OQGUP\u001b[0m",
    ].join("\n");

    expect(parseProviderAccountLoginOutput(output)).toEqual({
      loginUrl: "https://auth.openai.com/codex/device",
      loginCode: "GDH4-OQGUP",
    });
  });

  test("extracts Claude OAuth URL without a device code", () => {
    const output =
      "Opening browser to sign in…\n" +
      "If the browser didn't open, visit: https://claude.com/cai/oauth/authorize?code=true&client_id=abc\n" +
      "Paste code here if prompted > ";

    expect(parseProviderAccountLoginOutput(output)).toEqual({
      loginUrl: "https://claude.com/cai/oauth/authorize?code=true&client_id=abc",
      loginCode: null,
    });
  });

  test("buildProviderAccountLoginMessage prefers URL and code", () => {
    expect(
      buildProviderAccountLoginMessage({
        loginUrl: "https://auth.openai.com/codex/device",
        loginCode: "ABCD-EFGHI",
      }),
    ).toContain("ABCD-EFGHI");
    expect(stripAnsi("\u001b[94mhi\u001b[0m")).toBe("hi");
  });
});
