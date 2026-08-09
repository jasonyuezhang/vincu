import path from "node:path";
import type { ProviderOverride } from "../agent/provider-launch-config.js";
import {
  isProviderAccountBase,
  PROVIDER_ACCOUNTS_DIRNAME,
  VINCU_PROVIDER_ACCOUNT_ENV,
  type ProviderAccountBase,
} from "./constants.js";

export function providerAccountsRoot(vincuHome: string): string {
  return path.join(vincuHome, PROVIDER_ACCOUNTS_DIRNAME);
}

export function providerAccountHomePath(vincuHome: string, providerId: string): string {
  return path.join(providerAccountsRoot(vincuHome), providerId);
}

export function buildProviderAccountEnv(
  base: ProviderAccountBase,
  homePath: string,
): Record<string, string> {
  const env: Record<string, string> = {
    [VINCU_PROVIDER_ACCOUNT_ENV]: "1",
  };
  if (base === "claude") {
    env.CLAUDE_CONFIG_DIR = homePath;
  } else {
    env.CODEX_HOME = homePath;
  }
  return env;
}

export function isProviderAccountOverride(
  override: ProviderOverride | undefined,
  vincuHome: string,
): boolean {
  if (!override?.extends || !isProviderAccountBase(override.extends)) {
    return false;
  }
  if (override.env?.[VINCU_PROVIDER_ACCOUNT_ENV] === "1") {
    return true;
  }
  const accountsRoot = providerAccountsRoot(vincuHome);
  const home =
    override.extends === "claude" ? override.env?.CLAUDE_CONFIG_DIR : override.env?.CODEX_HOME;
  return typeof home === "string" && home.startsWith(`${accountsRoot}${path.sep}`);
}

export function resolveProviderAccountHome(
  override: ProviderOverride,
  base: ProviderAccountBase,
  options?: { vincuHome?: string; providerId?: string },
): string | null {
  const home = base === "claude" ? override.env?.CLAUDE_CONFIG_DIR : override.env?.CODEX_HOME;
  if (typeof home === "string" && home.length > 0) {
    return home;
  }
  // After older daemons stripped home env from mutable config, recover the
  // deterministic path under $VINCU_HOME/provider-accounts/<id>/.
  if (
    options?.vincuHome &&
    options.providerId &&
    override.env?.[VINCU_PROVIDER_ACCOUNT_ENV] === "1"
  ) {
    return providerAccountHomePath(options.vincuHome, options.providerId);
  }
  return null;
}

export function slugifyProviderAccountLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug.length > 0 ? slug : "account";
}

export function allocateProviderAccountId(options: {
  base: ProviderAccountBase;
  label: string;
  existingIds: ReadonlySet<string>;
}): string {
  const slug = slugifyProviderAccountLabel(options.label);
  const baseId = `${options.base}-${slug}`;
  if (!options.existingIds.has(baseId)) {
    return baseId;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!options.existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `${baseId}-${Date.now().toString(36)}`;
}
