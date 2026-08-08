import type {
  AgentSnapshotPayload,
  CreateAgentRequestMessage,
  FetchWorkspacesRequestMessage,
  FetchWorkspacesResponseMessage,
  GetProvidersSnapshotResponseMessage,
  ListAvailableProvidersResponse,
  ListProviderFeaturesRequestMessage,
  ListProviderFeaturesResponseMessage,
  ListProviderModelsResponseMessage,
  ListProviderModesResponseMessage,
  MutableDaemonConfig,
  MutableDaemonConfigPatch,
  ProviderDiagnosticResponseMessage,
  ProjectPlacementPayload,
  RefreshProvidersSnapshotResponseMessage,
  SendAgentMessageRequest,
  SessionOutboundMessage,
  WorkspaceDescriptorPayload,
} from "@getvincu/protocol/messages";
import { DaemonClient } from "./daemon-client.js";
import type {
  FetchAgentTimelineCursor,
  FetchAgentTimelineDirection,
  FetchAgentTimelinePayload,
  FetchAgentTimelineProjection,
} from "./daemon-client.js";

export { DaemonClient };
export type {
  DaemonClientConfig,
  DaemonEvent,
  BrowserAutomationExecuteRequestMessage,
  BrowserAutomationExecuteResponseMessage,
  WebSocketFactory,
  WebSocketLike,
} from "./daemon-client.js";

export type ConnectionState =
  | { status: "idle" }
  | { status: "connecting"; attempt: number }
  | { status: "connected" }
  | { status: "disconnected"; reason?: string }
  | { status: "disposed" };

export interface VincuLogger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface VincuClientConfig {
  url: string;
  clientId?: string;
  appVersion?: string;
  runtimeGeneration?: number | null;
  password?: string;
  authHeader?: string;
  headers?: Record<string, string>;
  suppressSendErrors?: boolean;
  logger?: VincuLogger;
  connectTimeoutMs?: number;
  e2ee?: {
    enabled?: boolean;
    daemonPublicKeyB64?: string;
  };
  reconnect?: {
    enabled?: boolean;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  runtimeMetricsIntervalMs?: number;
  runtimeMetricsWindowMs?: number;
}

export type VincuWorkspace = WorkspaceDescriptorPayload;
export type VincuAgent = AgentSnapshotPayload;
export type VincuWorkspaceListOptions = Omit<
  FetchWorkspacesRequestMessage,
  "type" | "requestId"
> & {
  requestId?: string;
};

export interface VincuWorkspaceListResult {
  requestId: string;
  subscriptionId?: string | null;
  entries: VincuWorkspace[];
  pageInfo: FetchWorkspacesResponseMessage["payload"]["pageInfo"];
}

export interface VincuWorkspaceOpenOptions {
  cwd: string;
  requestId?: string;
}

export interface VincuWorkspaceOpenResult {
  requestId: string;
  workspace: VincuWorkspaceHandle | null;
  error: string | null;
}

export interface VincuWorkspaceArchiveResult {
  requestId: string;
  workspaceId: string;
  archivedAt: string | null;
  error: string | null;
}

export type VincuWorkspaceUpdate = Extract<
  SessionOutboundMessage,
  { type: "workspace_update" }
>["payload"];

export type VincuWorkspaceUpdateHandler = (update: VincuWorkspaceUpdate) => void;

/**
 * A handle is a stable typed reference to a daemon resource. Its identity is the
 * daemon id, and `latest()` only returns the most recent snapshot this handle has
 * seen through construction, `refetch()`, or this handle's local subscription.
 */
export interface VincuWorkspaceHandle {
  readonly id: string;
  latest(): VincuWorkspace | null;
  /**
   * Fetches a fresh workspace snapshot through the existing workspace list RPC,
   * exact-matches this handle id from the result, and updates `latest()`.
   */
  refetch(options?: { requestId?: string }): Promise<VincuWorkspace | null>;
  archive(requestId?: string): Promise<VincuWorkspaceArchiveResult>;
  /**
   * Subscribes to already-emitted daemon workspace_update events for this id.
   * This returns a local unsubscribe function; it does not own app cache state or
   * send a daemon unsubscribe RPC. Call `workspaces.list({ subscribe: {} })` when
   * the daemon should start streaming workspace directory updates.
   */
  subscribe(handler: (update: VincuWorkspaceUpdate) => void): () => void;
}

export interface VincuWorkspaceActions {
  list(options?: VincuWorkspaceListOptions): Promise<VincuWorkspaceListResult>;
  ref(workspace: string | VincuWorkspace): VincuWorkspaceHandle;
  open(
    input: string | VincuWorkspaceOpenOptions,
    requestId?: string,
  ): Promise<VincuWorkspaceOpenResult>;
  create(
    input: string | VincuWorkspaceOpenOptions,
    requestId?: string,
  ): Promise<VincuWorkspaceOpenResult>;
  archive(
    workspace: string | VincuWorkspaceHandle,
    requestId?: string,
  ): Promise<VincuWorkspaceArchiveResult>;
  /**
   * Local event subscription over the low-level driver's workspace_update stream.
   * The returned function only removes this SDK listener.
   */
  subscribe(handler: VincuWorkspaceUpdateHandler): () => void;
}

type VincuAgentSessionConfig = CreateAgentRequestMessage["config"];
type VincuAgentProvider = VincuAgentSessionConfig["provider"];
type VincuAgentConfigOverrides = Partial<Omit<VincuAgentSessionConfig, "provider" | "cwd">>;

export interface VincuAgentCreateOptions extends VincuAgentConfigOverrides {
  config?: VincuAgentSessionConfig;
  provider?: CreateAgentRequestMessage["config"]["provider"];
  cwd?: string;
  workspaceId?: string;
  callerAgentId?: string;
  initialPrompt?: string;
  clientMessageId?: string;
  outputSchema?: Record<string, unknown>;
  images?: CreateAgentRequestMessage["images"];
  attachments?: CreateAgentRequestMessage["attachments"];
  git?: CreateAgentRequestMessage["git"];
  requestId?: string;
  labels?: Record<string, string>;
}

export interface VincuAgentRefetchResult {
  agent: VincuAgent;
  project: ProjectPlacementPayload | null;
}

export interface VincuAgentTimelineRefetchOptions {
  direction?: FetchAgentTimelineDirection;
  cursor?: FetchAgentTimelineCursor;
  limit?: number;
  projection?: FetchAgentTimelineProjection;
  requestId?: string;
}

export interface VincuAgentSendOptions {
  messageId?: string;
  images?: Array<{ data: string; mimeType: string }>;
  attachments?: SendAgentMessageRequest["attachments"];
}

export type VincuAgentUpdate = Extract<SessionOutboundMessage, { type: "agent_update" }>["payload"];

export type VincuAgentStream = Extract<SessionOutboundMessage, { type: "agent_stream" }>["payload"];

export type VincuAgentUpdateHandler = (update: VincuAgentUpdate) => void;

export interface VincuAgentTimelineHandle {
  /**
   * Fetches a fresh timeline page through the existing daemon RPC. If the daemon
   * includes an agent snapshot in the response, the parent handle's `latest()`
   * is updated to that snapshot.
   */
  refetch(options?: VincuAgentTimelineRefetchOptions): Promise<FetchAgentTimelinePayload>;
  /**
   * Local listener for agent_stream events matching this handle id. It does not
   * retain timeline entries or own application cache state.
   */
  subscribe(handler: (event: VincuAgentStream) => void): () => void;
}

/**
 * Agent handles follow the same identity/snapshot rule as workspace handles:
 * `id` is stable, while `latest()` is only the newest snapshot observed by this
 * handle through construction, `refetch()`, timeline refetch, archive, or local
 * agent_update subscription.
 */
export interface VincuAgentHandle {
  readonly id: string;
  readonly timeline: VincuAgentTimelineHandle;
  latest(): VincuAgent | null;
  refetch(requestId?: string): Promise<VincuAgentRefetchResult | null>;
  send(text: string, options?: VincuAgentSendOptions): Promise<void>;
  archive(): Promise<{ archivedAt: string }>;
  detach(): Promise<void>;
  subscribe(handler: (update: VincuAgentUpdate) => void): () => void;
}

export interface VincuAgentActions {
  ref(agent: string | VincuAgent): VincuAgentHandle;
  create(options: VincuAgentCreateOptions): Promise<VincuAgentHandle>;
  /**
   * Local event subscription over the low-level driver's agent_update stream.
   * The returned function only removes this SDK listener.
   */
  subscribe(handler: VincuAgentUpdateHandler): () => void;
}

export interface VincuProviderConfig extends VincuProviderConfigInput {
  provider: VincuAgentProvider;
}
export type VincuProviderFeatureValues = Record<string, unknown>;

export interface VincuProviderConfigInput {
  model?: string;
  modeId?: string;
  thinkingOptionId?: string;
  featureValues?: VincuProviderFeatureValues;
}

export type VincuProviderModelsResult = ListProviderModelsResponseMessage["payload"];
export type VincuProviderModesResult = ListProviderModesResponseMessage["payload"];
export type VincuProviderFeaturesInput = ListProviderFeaturesRequestMessage["draftConfig"];
export type VincuProviderFeaturesResult = ListProviderFeaturesResponseMessage["payload"];
export type VincuProviderAvailabilityResult = ListAvailableProvidersResponse["payload"];
export type VincuProviderSnapshotResult = GetProvidersSnapshotResponseMessage["payload"];
export type VincuProviderSnapshotUpdate = Extract<
  SessionOutboundMessage,
  { type: "providers_snapshot_update" }
>["payload"];
export type VincuProviderRefreshResult = RefreshProvidersSnapshotResponseMessage["payload"];
export type VincuProviderDiagnosticResult = ProviderDiagnosticResponseMessage["payload"];

export interface VincuProviderListOptions {
  cwd?: string;
  requestId?: string;
}

export interface VincuProviderRefreshOptions {
  cwd?: string;
  providers?: VincuAgentProvider[];
  requestId?: string;
}

export interface VincuProviderActions {
  codex(input?: VincuProviderConfigInput): VincuProviderConfig;
  claude(input?: VincuProviderConfigInput): VincuProviderConfig;
  opencode(input?: VincuProviderConfigInput): VincuProviderConfig;
  copilot(input?: VincuProviderConfigInput): VincuProviderConfig;
  config(provider: VincuAgentProvider, input?: VincuProviderConfigInput): VincuProviderConfig;
  listModels(
    provider: VincuAgentProvider,
    options?: VincuProviderListOptions,
  ): Promise<VincuProviderModelsResult>;
  listModes(
    provider: VincuAgentProvider,
    options?: VincuProviderListOptions,
  ): Promise<VincuProviderModesResult>;
  listFeatures(
    draftConfig: VincuProviderFeaturesInput,
    options?: { requestId?: string },
  ): Promise<VincuProviderFeaturesResult>;
  listAvailable(options?: { requestId?: string }): Promise<VincuProviderAvailabilityResult>;
  snapshot(options?: VincuProviderListOptions): Promise<VincuProviderSnapshotResult>;
  refresh(options?: VincuProviderRefreshOptions): Promise<VincuProviderRefreshResult>;
  diagnostic(
    provider: VincuAgentProvider,
    options?: { requestId?: string },
  ): Promise<VincuProviderDiagnosticResult>;
  subscribe(handler: (update: VincuProviderSnapshotUpdate) => void): () => void;
}

export interface VincuConfigActions {
  /**
   * Reads daemon config through the existing config RPC. Provider profiles,
   * custom provider entries, keys/env, custom binaries, and provider enablement
   * are currently config-file-shaped daemon state, so the SDK exposes this raw
   * typed surface instead of pretending there are higher-level provider-settings
   * RPCs.
   */
  get(requestId?: string): Promise<{ requestId: string; config: MutableDaemonConfig }>;
  /**
   * Patches daemon config through the existing config RPC. The daemon validates
   * and persists supported fields; unsupported provider/settings workflows remain
   * daemon gaps until first-class RPCs exist.
   */
  patch(
    config: MutableDaemonConfigPatch,
    requestId?: string,
  ): Promise<{ requestId: string; config: MutableDaemonConfig }>;
}

export interface VincuClient {
  readonly workspaces: VincuWorkspaceActions;
  readonly agents: VincuAgentActions;
  readonly providers: VincuProviderActions;
  readonly config: VincuConfigActions;
  connect(): Promise<void>;
  close(): Promise<void>;
  ensureConnected(): void;
  getConnectionState(): ConnectionState;
}

export function createVincuClient(config: VincuClientConfig): VincuClient {
  const daemonClient = new DaemonClient({
    ...config,
    clientId: config.clientId ?? createGeneratedClientId(),
    clientType: "cli",
  });
  const createWorkspaceHandle = createWorkspaceHandleFactory(daemonClient);
  const createAgentHandle = createAgentHandleFactory(daemonClient);

  return {
    workspaces: {
      list: (options) => daemonClient.fetchWorkspaces(options),
      ref: (workspace) => createWorkspaceHandle(workspace),
      open: (input, requestId) =>
        openWorkspace(daemonClient, createWorkspaceHandle, input, requestId),
      create: (input, requestId) =>
        openWorkspace(daemonClient, createWorkspaceHandle, input, requestId),
      archive: (workspace, requestId) =>
        daemonClient.archiveWorkspace(resolveWorkspaceId(workspace), requestId),
      subscribe: (handler) =>
        daemonClient.on("workspace_update", (message) => {
          handler(message.payload);
        }),
    },
    agents: {
      ref: (agent) => createAgentHandle(agent),
      create: async (options) => {
        const agent = await daemonClient.createAgent(options);
        return createAgentHandle(agent);
      },
      subscribe: (handler) =>
        daemonClient.on("agent_update", (message) => {
          handler(message.payload);
        }),
    },
    providers: {
      codex: (input) => providerConfig("codex", input),
      claude: (input) => providerConfig("claude", input),
      opencode: (input) => providerConfig("opencode", input),
      copilot: (input) => providerConfig("copilot", input),
      config: (provider, input) => providerConfig(provider, input),
      listModels: (provider, options) => daemonClient.listProviderModels(provider, options),
      listModes: (provider, options) => daemonClient.listProviderModes(provider, options),
      listFeatures: (draftConfig, options) =>
        daemonClient.listProviderFeatures(draftConfig, options),
      listAvailable: (options) => daemonClient.listAvailableProviders(options),
      snapshot: (options) => daemonClient.getProvidersSnapshot(options),
      refresh: (options) => daemonClient.refreshProvidersSnapshot(options),
      diagnostic: (provider, options) => daemonClient.getProviderDiagnostic(provider, options),
      subscribe: (handler) =>
        daemonClient.on("providers_snapshot_update", (message) => {
          handler(message.payload);
        }),
    },
    config: {
      get: (requestId) => daemonClient.getDaemonConfig(requestId),
      patch: (patch, requestId) => daemonClient.patchDaemonConfig(patch, requestId),
    },
    connect: () => daemonClient.connect(),
    close: () => daemonClient.close(),
    ensureConnected: () => daemonClient.ensureConnected(),
    getConnectionState: () => daemonClient.getConnectionState(),
  };
}

type WorkspaceHandleFactory = (workspace: string | VincuWorkspace) => VincuWorkspaceHandle;
type AgentHandleFactory = (agent: string | VincuAgent) => VincuAgentHandle;

function createWorkspaceHandleFactory(daemonClient: DaemonClient): WorkspaceHandleFactory {
  return (workspace) => {
    const id = typeof workspace === "string" ? workspace : workspace.id;
    let latest = typeof workspace === "string" ? null : workspace;

    return {
      id,
      latest: () => latest,
      refetch: async (options) => {
        // Best-effort: fetches one page and matches by id client-side, so a workspace beyond
        // the first page won't be found. TODO: add a "get workspace by id" lookup and resolve
        // by exact id instead of paging.
        const result = await daemonClient.fetchWorkspaces({
          requestId: options?.requestId,
          page: { limit: 25 },
        });
        latest = result.entries.find((entry) => entry.id === id) ?? null;
        return latest;
      },
      archive: async (requestId) => {
        const result = await daemonClient.archiveWorkspace(id, requestId);
        if (latest) {
          latest = { ...latest, archivingAt: result.archivedAt };
        }
        return result;
      },
      subscribe: (handler) =>
        daemonClient.on("workspace_update", (message) => {
          const update = message.payload;
          if (update.kind === "upsert" && update.workspace.id === id) {
            latest = update.workspace;
            handler(update);
          }
          if (update.kind === "remove" && update.id === id) {
            latest = null;
            handler(update);
          }
        }),
    };
  };
}

function createAgentHandleFactory(daemonClient: DaemonClient): AgentHandleFactory {
  return (agent) => {
    const id = typeof agent === "string" ? agent : agent.id;
    let latest = typeof agent === "string" ? null : agent;

    const handle: VincuAgentHandle = {
      id,
      timeline: {
        refetch: async (options) => {
          const result = await daemonClient.fetchAgentTimeline(id, options);
          if (result.agent) {
            latest = result.agent;
          }
          return result;
        },
        subscribe: (handler) =>
          daemonClient.on("agent_stream", (message) => {
            if (message.payload.agentId === id) {
              handler(message.payload);
            }
          }),
      },
      latest: () => latest,
      refetch: async (requestId) => {
        const result = await daemonClient.fetchAgent({ agentId: id, requestId });
        latest = result?.agent ?? null;
        return result;
      },
      send: async (text, options) => {
        await daemonClient.sendAgentMessage(id, text, options);
      },
      archive: async () => {
        const result = await daemonClient.archiveAgent(id);
        if (latest) {
          latest = { ...latest, archivedAt: result.archivedAt };
        }
        return result;
      },
      detach: async () => {
        await daemonClient.detachAgent(id);
      },
      subscribe: (handler) =>
        daemonClient.on("agent_update", (message) => {
          const update = message.payload;
          if (update.kind === "upsert" && update.agent.id === id) {
            latest = update.agent;
            handler(update);
          }
          if (update.kind === "remove" && update.agentId === id) {
            latest = null;
            handler(update);
          }
        }),
    };

    return handle;
  };
}

async function openWorkspace(
  daemonClient: DaemonClient,
  createWorkspaceHandle: WorkspaceHandleFactory,
  input: string | VincuWorkspaceOpenOptions,
  requestId?: string,
): Promise<VincuWorkspaceOpenResult> {
  const options = typeof input === "string" ? { cwd: input, requestId } : input;
  const result = await daemonClient.openProject(options.cwd, options.requestId);
  return {
    ...result,
    workspace: result.workspace ? createWorkspaceHandle(result.workspace) : null,
  };
}

function resolveWorkspaceId(workspace: string | VincuWorkspaceHandle): string {
  return typeof workspace === "string" ? workspace : workspace.id;
}

function providerConfig(
  provider: VincuAgentProvider,
  input: VincuProviderConfigInput = {},
): VincuProviderConfig {
  return {
    provider,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.modeId !== undefined ? { modeId: input.modeId } : {}),
    ...(input.thinkingOptionId !== undefined ? { thinkingOptionId: input.thinkingOptionId } : {}),
    ...(input.featureValues !== undefined ? { featureValues: input.featureValues } : {}),
  };
}

function createGeneratedClientId(): string {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `vincu-sdk-${randomId}`;
}
