export const PROVIDER_ACCOUNTS_DIRNAME = "provider-accounts";
export const VINCU_PROVIDER_ACCOUNT_ENV = "VINCU_PROVIDER_ACCOUNT";
export const PROVIDER_ACCOUNT_BASES = ["claude", "codex"] as const;

export type ProviderAccountBase = (typeof PROVIDER_ACCOUNT_BASES)[number];

export function isProviderAccountBase(value: string): value is ProviderAccountBase {
  return (PROVIDER_ACCOUNT_BASES as readonly string[]).includes(value);
}
