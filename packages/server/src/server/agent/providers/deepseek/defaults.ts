import type {
  ProviderProfileModel,
  ProviderRuntimeSettings,
} from "../../provider-launch-config.js";

export const DEEPSEEK_ANTHROPIC_BASE_URL = "https://api.deepseek.com/anthropic";
export const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";

export const DEEPSEEK_V4_MODELS: ProviderProfileModel[] = [
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    description: "Frontier DeepSeek V4 model for coding agents",
    isDefault: true,
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    description: "Faster DeepSeek V4 model for high-volume work",
  },
];

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function resolveDeepSeekApiKey(
  runtimeSettings?: ProviderRuntimeSettings,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return (
    firstNonEmpty(
      runtimeSettings?.env?.ANTHROPIC_AUTH_TOKEN,
      runtimeSettings?.env?.[DEEPSEEK_API_KEY_ENV],
      env.ANTHROPIC_AUTH_TOKEN,
      env[DEEPSEEK_API_KEY_ENV],
    ) ?? null
  );
}

/**
 * Bake DeepSeek Anthropic-compatible API defaults onto Claude Code runtime settings.
 * Caller env keys win for base URL; auth is resolved from override or host env.
 */
export function mergeDeepSeekDefaults(
  runtimeSettings?: ProviderRuntimeSettings,
  env: NodeJS.ProcessEnv = process.env,
): ProviderRuntimeSettings {
  const apiKey = resolveDeepSeekApiKey(runtimeSettings, env);
  const envOverlay: Record<string, string> = {
    ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL,
    ...runtimeSettings?.env,
  };
  if (apiKey) {
    envOverlay.ANTHROPIC_AUTH_TOKEN = apiKey;
  }

  const disallowedTools = Array.from(
    new Set([...(runtimeSettings?.disallowedTools ?? []), "WebSearch"]),
  );

  return {
    ...runtimeSettings,
    env: envOverlay,
    disallowedTools,
  };
}
