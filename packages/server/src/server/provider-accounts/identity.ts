import { existsSync, promises as fs, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ProviderAccountBase } from "@getvincu/protocol/messages";

const IDENTITY_FILENAME = ".vincu-account-identity.json";

interface ProviderAccountIdentity {
  email?: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const padded = parts[1].padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function identityPath(homePath: string): string {
  return path.join(homePath, IDENTITY_FILENAME);
}

export function readCachedProviderAccountEmail(homePath: string): string | null {
  const filePath = identityPath(homePath);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ProviderAccountIdentity;
    return typeof parsed.email === "string" && parsed.email.trim().length > 0
      ? parsed.email.trim()
      : null;
  } catch {
    return null;
  }
}

export async function clearProviderAccountIdentity(homePath: string): Promise<void> {
  await fs.rm(identityPath(homePath), { force: true }).catch(() => undefined);
}

export async function writeProviderAccountIdentity(
  homePath: string,
  identity: { email: string },
): Promise<void> {
  const email = identity.email.trim();
  if (!email) {
    return;
  }
  const filePath = identityPath(homePath);
  const existing = readCachedProviderAccountEmail(homePath);
  if (existing === email) {
    return;
  }
  await fs.mkdir(homePath, { recursive: true, mode: 0o700 });
  writeFileSync(filePath, `${JSON.stringify({ email }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function readCodexAccountEmail(homePath: string): string | null {
  const authPath = path.join(homePath, "auth.json");
  if (!existsSync(authPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(authPath, "utf8")) as {
      email?: unknown;
      tokens?: { id_token?: unknown };
    };
    if (typeof parsed.email === "string" && parsed.email.trim().length > 0) {
      return parsed.email.trim();
    }
    const idToken = parsed.tokens?.id_token;
    if (typeof idToken !== "string") {
      return null;
    }
    const payload = decodeJwtPayload(idToken);
    const email = payload?.email;
    return typeof email === "string" && email.trim().length > 0 ? email.trim() : null;
  } catch {
    return null;
  }
}

export function parseClaudeAuthStatusOutput(output: string): {
  authenticated: boolean | null;
  email: string | null;
} {
  const trimmed = output.trim();
  if (!trimmed) {
    return { authenticated: null, email: null };
  }
  try {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return { authenticated: null, email: null };
    }
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      loggedIn?: unknown;
      email?: unknown;
    };
    return {
      authenticated: typeof parsed.loggedIn === "boolean" ? parsed.loggedIn : null,
      email:
        typeof parsed.email === "string" && parsed.email.trim().length > 0
          ? parsed.email.trim()
          : null,
    };
  } catch {
    return { authenticated: null, email: null };
  }
}

export function readProviderAccountEmail(options: {
  base: ProviderAccountBase;
  homePath: string;
}): string | null {
  const cached = readCachedProviderAccountEmail(options.homePath);
  if (cached) {
    return cached;
  }
  if (options.base === "codex") {
    return readCodexAccountEmail(options.homePath);
  }
  return null;
}
