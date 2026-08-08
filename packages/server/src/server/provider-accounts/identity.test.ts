import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  parseClaudeAuthStatusOutput,
  readProviderAccountEmail,
  writeProviderAccountIdentity,
} from "./identity.js";

function encodeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

describe("provider account identity", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reads Codex email from id_token and caches it", async () => {
    const homePath = mkdtempSync(path.join(tmpdir(), "vincu-account-identity-"));
    tempDirs.push(homePath);
    writeFileSync(
      path.join(homePath, "auth.json"),
      JSON.stringify({
        tokens: {
          access_token: "access",
          id_token: encodeJwt({ email: "work@example.com", email_verified: true }),
        },
      }),
      "utf8",
    );

    expect(readProviderAccountEmail({ base: "codex", homePath })).toBe("work@example.com");
    await writeProviderAccountIdentity(homePath, { email: "work@example.com" });
    expect(readProviderAccountEmail({ base: "claude", homePath })).toBe("work@example.com");
  });

  test("parses Claude auth status JSON for email", () => {
    expect(
      parseClaudeAuthStatusOutput(`{
  "loggedIn": true,
  "email": "personal@example.com",
  "orgName": "Acme"
}`),
    ).toEqual({
      authenticated: true,
      email: "personal@example.com",
    });
  });
});
