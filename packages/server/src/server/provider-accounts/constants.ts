export const PROVIDER_ACCOUNTS_DIRNAME = "provider-accounts";
export const VINCU_PROVIDER_ACCOUNT_ENV = "VINCU_PROVIDER_ACCOUNT";
export const PROVIDER_ACCOUNT_BASES = ["claude", "codex", "cursor"] as const;

export type ProviderAccountBase = (typeof PROVIDER_ACCOUNT_BASES)[number];

export function isProviderAccountBase(value: string): value is ProviderAccountBase {
  return (PROVIDER_ACCOUNT_BASES as readonly string[]).includes(value);
}

/** Env var that carries a pasted API key for instance profiles. */
export const PROVIDER_API_KEY_ENV: Record<ProviderAccountBase | "deepseek", string> = {
  claude: "ANTHROPIC_API_KEY",
  codex: "OPENAI_API_KEY",
  cursor: "CURSOR_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

export function apiKeyEnvForProviderBase(base: string): string | null {
  if (base in PROVIDER_API_KEY_ENV) {
    return PROVIDER_API_KEY_ENV[base as keyof typeof PROVIDER_API_KEY_ENV];
  }
  return null;
}
