import type { MutableDaemonConfig } from "@getvincu/protocol/messages";

const PROVIDER_ACCOUNT_ENV = "VINCU_PROVIDER_ACCOUNT";

export type ProviderAccountBase = "claude" | "codex" | "cursor";

const PROVIDER_ACCOUNT_BASES: readonly ProviderAccountBase[] = ["claude", "codex", "cursor"];

export function isProviderAccountBase(value: string): value is ProviderAccountBase {
  return (PROVIDER_ACCOUNT_BASES as readonly string[]).includes(value);
}

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
  return typeof base === "string" && isProviderAccountBase(base) ? base : null;
}

export function providerAccountCompanyName(base: ProviderAccountBase): string {
  if (base === "claude") return "Claude";
  if (base === "codex") return "Codex";
  return "Cursor";
}

export function nextDefaultProviderAccountLabel(
  base: ProviderAccountBase | string,
  config: MutableDaemonConfig | null | undefined,
): string {
  const prefix =
    typeof base === "string" && isProviderAccountBase(base)
      ? providerAccountCompanyName(base)
      : base.charAt(0).toUpperCase() + base.slice(1);
  const existing = Object.keys(config?.providers ?? {}).filter((providerId) => {
    const provider = config?.providers?.[providerId];
    return (
      provider && typeof provider === "object" && "extends" in provider && provider.extends === base
    );
  }).length;
  return existing === 0 ? `${prefix} account` : `${prefix} account ${existing + 1}`;
}

export const ADDABLE_BUILTIN_PROVIDERS: Array<{
  id: string;
  label: string;
  supportsOauth: boolean;
  supportsApiKey: boolean;
}> = [
  { id: "claude", label: "Claude", supportsOauth: true, supportsApiKey: true },
  { id: "codex", label: "Codex", supportsOauth: true, supportsApiKey: true },
  { id: "cursor", label: "Cursor", supportsOauth: true, supportsApiKey: true },
  { id: "copilot", label: "Copilot", supportsOauth: false, supportsApiKey: false },
  { id: "opencode", label: "OpenCode", supportsOauth: false, supportsApiKey: false },
  { id: "pi", label: "Pi", supportsOauth: false, supportsApiKey: false },
  { id: "deepseek", label: "DeepSeek", supportsOauth: false, supportsApiKey: true },
  { id: "omp", label: "Oh My Pi", supportsOauth: false, supportsApiKey: false },
];
