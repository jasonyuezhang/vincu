import { VINCU_PROVIDER_ACCOUNT_ENV } from "./constants.js";

/**
 * Mutable daemon config only persists account markers + home paths.
 * Arbitrary env secrets on custom-provider overrides stay daemon-only.
 */
export function toMutableProviderAccountEnv(
  env: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (env?.[VINCU_PROVIDER_ACCOUNT_ENV] !== "1") {
    return undefined;
  }

  const accountEnv: Record<string, string> = {
    [VINCU_PROVIDER_ACCOUNT_ENV]: "1",
  };
  const claudeHome = env.CLAUDE_CONFIG_DIR;
  if (typeof claudeHome === "string" && claudeHome.length > 0) {
    accountEnv.CLAUDE_CONFIG_DIR = claudeHome;
  }
  const codexHome = env.CODEX_HOME;
  if (typeof codexHome === "string" && codexHome.length > 0) {
    accountEnv.CODEX_HOME = codexHome;
  }
  return accountEnv;
}
