import { createTestVincuDaemon, type TestVincuDaemon } from "./vincu-daemon.js";
import { DaemonClient } from "./daemon-client.js";
import { createTestAgentClients } from "./fake-agent-client.js";

/**
 * Builtin providers are instance-only (enabledByDefault: false), so a bare test
 * daemon registers none of them. Tests that drive claude/codex/opencode by id
 * must seed an enabled override or the daemon reports "Unknown provider".
 */
export const ENABLED_BUILTIN_PROVIDER_OVERRIDES = {
  claude: { enabled: true },
  codex: { enabled: true },
  opencode: { enabled: true },
} as const;

export interface DaemonTestContext {
  daemon: TestVincuDaemon;
  client: DaemonClient;
  cleanup: () => Promise<void>;
}

/**
 * Create a test context with an isolated daemon and connected client.
 *
 * Usage:
 * ```typescript
 * let ctx: DaemonTestContext;
 *
 * beforeEach(async () => {
 *   ctx = await createDaemonTestContext();
 * });
 *
 * afterEach(async () => {
 *   await ctx.cleanup();
 * });
 *
 * test("creates agent", async () => {
 *   const agent = await ctx.client.createAgent({
 *     provider: "codex",
 *     cwd: "/tmp",
 *   });
 *   expect(agent.id).toBeTruthy();
 * });
 * ```
 */
export async function createDaemonTestContext(
  options?: Parameters<typeof createTestVincuDaemon>[0],
): Promise<DaemonTestContext> {
  const daemon = await createTestVincuDaemon({
    agentClients: createTestAgentClients(),
    ...options,
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
  });
  await client.connect();
  await client.fetchAgents({ subscribe: { subscriptionId: "test" } });

  return {
    daemon,
    client,
    cleanup: async () => {
      await client.close();
      await daemon.close();
    },
  };
}
