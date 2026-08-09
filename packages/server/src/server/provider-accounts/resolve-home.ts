import os from "node:os";
import path from "node:path";
import type { ProviderRuntimeSettings } from "../agent/provider-launch-config.js";

export function resolveClaudeConfigDirFromRuntime(
  runtimeSettings?: ProviderRuntimeSettings,
  configDir?: string,
): string {
  return (
    configDir ??
    runtimeSettings?.env?.CLAUDE_CONFIG_DIR ??
    process.env.CLAUDE_CONFIG_DIR ??
    path.join(os.homedir(), ".claude")
  );
}

export function resolveCodexHomeDirFromRuntime(runtimeSettings?: ProviderRuntimeSettings): string {
  return (
    runtimeSettings?.env?.CODEX_HOME ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex")
  );
}
