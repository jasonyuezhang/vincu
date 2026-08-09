import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProviderOverride } from "../agent/provider-launch-config.js";
import {
  apiKeyEnvForProviderBase,
  isProviderAccountBase,
  VINCU_PROVIDER_ACCOUNT_ENV,
  type ProviderAccountBase,
} from "./constants.js";

export function providerAccountCredentialPath(base: ProviderAccountBase, homePath: string): string {
  if (base === "codex") {
    return path.join(homePath, "auth.json");
  }
  if (base === "cursor") {
    return path.join(homePath, "cli-config.json");
  }
  return path.join(homePath, ".credentials.json");
}

function cursorCliConfigHasAuth(homePath: string): boolean {
  const configPath = path.join(homePath, "cli-config.json");
  if (!existsSync(configPath)) {
    // Legacy layouts used by older cursor-agent builds.
    return (
      existsSync(path.join(homePath, "auth.json")) || existsSync(path.join(homePath, "credentials"))
    );
  }
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      authInfo?: unknown;
    };
    return parsed.authInfo != null && typeof parsed.authInfo === "object";
  } catch {
    return false;
  }
}

/** True when an OAuth account home has local credentials on disk. */
export function hasProviderAccountCredentials(
  base: ProviderAccountBase,
  homePath: string,
): boolean {
  if (base === "cursor") {
    return cursorCliConfigHasAuth(homePath);
  }
  return existsSync(providerAccountCredentialPath(base, homePath));
}

/**
 * OAuth account providers stay disabled until login writes credentials.
 * Non-account overrides are always "ready" for this check.
 */
export function isProviderAccountReadyForEnable(override: ProviderOverride): boolean {
  if (override.env?.[VINCU_PROVIDER_ACCOUNT_ENV] !== "1") {
    return true;
  }
  const base = override.extends;
  if (!base || !isProviderAccountBase(base)) {
    return true;
  }
  let homePath: unknown;
  if (base === "claude") {
    homePath = override.env.CLAUDE_CONFIG_DIR;
  } else if (base === "codex") {
    homePath = override.env.CODEX_HOME;
  } else {
    homePath = override.env.CURSOR_CONFIG_DIR;
  }
  if (typeof homePath !== "string" || homePath.length === 0) {
    return false;
  }
  return hasProviderAccountCredentials(base, homePath);
}

/** True when an API-key profile has a non-empty key in env. */
export function hasProviderApiKey(override: ProviderOverride): boolean {
  const base = override.extends;
  if (!base) {
    return false;
  }
  const keyEnv = apiKeyEnvForProviderBase(base);
  if (!keyEnv) {
    return false;
  }
  const value = override.env?.[keyEnv];
  return typeof value === "string" && value.trim().length > 0;
}
