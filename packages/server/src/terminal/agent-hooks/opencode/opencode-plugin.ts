import type { AgentHookPluginFileInstallStrategy } from "../agent-hook-installer.js";

export const OPENCODE_PLUGIN_SOURCE = [
  "const STATUS_EVENTS = {",
  '  busy: "session.status.busy",',
  '  retry: "session.status.retry",',
  '  idle: "session.status.idle",',
  "};",
  "",
  "function vincuEventFor(event) {",
  '  if (event?.type === "permission.asked") return "permission.asked";',
  '  if (event?.type === "permission.replied") return "permission.replied";',
  '  if (event?.type !== "session.status") return null;',
  "  return STATUS_EVENTS[event?.properties?.status?.type] ?? null;",
  "}",
  "",
  "function runVincuHook(event) {",
  "  if (!process.env.VINCU_TERMINAL_ID) return;",
  "  try {",
  '    const child = Bun.spawn(["vincu", "hooks", "opencode", event], {',
  '      stdin: "ignore",',
  '      stdout: "ignore",',
  '      stderr: "ignore",',
  "    });",
  "    void child.exited.catch(() => {});",
  "  } catch {}",
  "}",
  "",
  "export default async () => ({",
  "  event: async ({ event }) => {",
  "    const vincuEvent = vincuEventFor(event);",
  "    if (vincuEvent) runVincuHook(vincuEvent);",
  "  },",
  "});",
  "",
].join("\n");

export function createOpenCodePluginInstallStrategy(): AgentHookPluginFileInstallStrategy {
  return {
    kind: "plugin-file",
    configDir: "opencode",
    configDirBase: "xdg-config",
    configFile: "plugins/vincu-terminal-activity.js",
    configDirEnvOverride: "OPENCODE_CONFIG_DIR",
    hookMarker: "vincu hooks opencode",
    source: OPENCODE_PLUGIN_SOURCE,
  };
}
