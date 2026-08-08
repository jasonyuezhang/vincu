import { existsSync } from "node:fs";
import path from "node:path";
import type { ProviderOverride } from "../agent/provider-launch-config.js";
import { isProviderAccountBase, VINCU_PROVIDER_ACCOUNT_ENV } from "./constants.js";

export function providerAccountCredentialPath(base: "claude" | "codex", homePath: string): string {
  return base === "codex"
    ? path.join(homePath, "auth.json")
    : path.join(homePath, ".credentials.json");
}

/** True when an OAuth account home has local credentials on disk. */
export function hasProviderAccountCredentials(base: "claude" | "codex", homePath: string): boolean {
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
  const homePath = base === "claude" ? override.env.CLAUDE_CONFIG_DIR : override.env.CODEX_HOME;
  if (typeof homePath !== "string" || homePath.length === 0) {
    return false;
  }
  return hasProviderAccountCredentials(base, homePath);
}
