import type { MutableDaemonConfig } from "@getvincu/protocol/messages";

const PROVIDER_ACCOUNT_ENV = "VINCU_PROVIDER_ACCOUNT";

export type ProviderAccountBase = "claude" | "codex";

export function isProviderAccountId(
  config: MutableDaemonConfig | null | undefined,
  providerId: string,
): boolean {
  return resolveProviderAccountBase(config, providerId) !== null;
}

export function resolveProviderAccountBase(
  config: MutableDaemonConfig | null | undefined,
  providerId: string,
): ProviderAccountBase | null {
  const provider = config?.providers?.[providerId];
  if (!provider || typeof provider !== "object") {
    return null;
  }
  const env = "env" in provider ? provider.env : undefined;
  if (!env || typeof env !== "object") {
    return null;
  }
  if ((env as Record<string, unknown>)[PROVIDER_ACCOUNT_ENV] !== "1") {
    return null;
  }
  if (!("extends" in provider)) {
    return null;
  }
  const base = provider.extends;
  return base === "claude" || base === "codex" ? base : null;
}

export function providerAccountCompanyName(base: ProviderAccountBase): string {
  return base === "claude" ? "Claude" : "Codex";
}

export function nextDefaultProviderAccountLabel(
  base: ProviderAccountBase,
  config: MutableDaemonConfig | null | undefined,
): string {
  const prefix = providerAccountCompanyName(base);
  const existing = Object.keys(config?.providers ?? {}).filter(
    (providerId) => resolveProviderAccountBase(config, providerId) === base,
  ).length;
  return existing === 0 ? `${prefix} account` : `${prefix} account ${existing + 1}`;
}
