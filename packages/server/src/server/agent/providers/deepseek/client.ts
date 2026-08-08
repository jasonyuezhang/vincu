import type { Logger } from "pino";
import type { AgentClient } from "../../agent-sdk-types.js";
import type { ProviderRuntimeSettings } from "../../provider-launch-config.js";
import { ClaudeAgentClient } from "../claude/agent.js";
import { mergeDeepSeekDefaults, resolveDeepSeekApiKey } from "./defaults.js";

/**
 * Claude Code client with DeepSeek API defaults and API-key-aware availability.
 * `provider` stays `"claude"` so the registry wraps the outer id as `deepseek`.
 */
export function createDeepSeekAgentClient(options: {
  logger: Logger;
  runtimeSettings?: ProviderRuntimeSettings;
}): AgentClient {
  const runtimeSettings = mergeDeepSeekDefaults(options.runtimeSettings);
  const inner = new ClaudeAgentClient({
    logger: options.logger,
    runtimeSettings,
  });

  const listImportableSessions = inner.listImportableSessions?.bind(inner);
  const importSession = inner.importSession?.bind(inner);
  const listFeatures = inner.listFeatures?.bind(inner);
  const getDiagnostic = inner.getDiagnostic?.bind(inner);

  return {
    provider: inner.provider,
    capabilities: inner.capabilities,
    createSession: inner.createSession.bind(inner),
    resumeSession: inner.resumeSession.bind(inner),
    fetchCatalog: inner.fetchCatalog.bind(inner),
    resolveDefaultModeId: inner.resolveDefaultModeId?.bind(inner),
    resolveConfiguredModel: inner.resolveConfiguredModel?.bind(inner),
    listFeatures: listFeatures ? async (config) => listFeatures(config) : undefined,
    listImportableSessions: listImportableSessions
      ? async (request) => listImportableSessions(request)
      : undefined,
    importSession: importSession
      ? async (input, context) => importSession(input, context)
      : undefined,
    async isAvailable(): Promise<boolean> {
      if (!resolveDeepSeekApiKey(runtimeSettings)) {
        return false;
      }
      return inner.isAvailable();
    },
    async getDiagnostic(): Promise<{ diagnostic: string }> {
      const base = getDiagnostic ? await getDiagnostic() : { diagnostic: "" };
      const apiKey = resolveDeepSeekApiKey(runtimeSettings);
      const authLine = `DeepSeek API key: ${
        apiKey ? "configured" : "missing (set DEEPSEEK_API_KEY or ANTHROPIC_AUTH_TOKEN)"
      }`;
      if (!base.diagnostic.trim()) {
        return {
          diagnostic: [
            "DeepSeek",
            authLine,
            `Endpoint: ${runtimeSettings.env?.ANTHROPIC_BASE_URL ?? ""}`,
          ].join("\n"),
        };
      }
      return {
        diagnostic: `${base.diagnostic}\n${authLine}`,
      };
    },
  };
}
