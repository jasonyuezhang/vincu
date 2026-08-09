/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderSnapshotEntry } from "@getvincu/protocol/agent-types";
import type { MutableDaemonConfig } from "@getvincu/protocol/messages";

const {
  theme,
  snapshotState,
  configState,
  patchConfigMock,
  openProviderSettingsMock,
  hostFeatures,
  createProviderAccountMock,
  loginProviderAccountMock,
} = vi.hoisted(() => ({
  theme: {
    spacing: { 1: 4, "1.5": 6, 2: 8, 3: 12, 4: 16, 6: 24 },
    iconSize: { sm: 14, md: 20 },
    fontSize: { xs: 11, sm: 13, base: 15 },
    fontWeight: { normal: "400", medium: "500" },
    borderRadius: { lg: 8 },
    opacity: { 50: 0.5 },
    colors: {
      surface1: "#111",
      surface2: "#222",
      surface3: "#333",
      foreground: "#fff",
      foregroundMuted: "#aaa",
      border: "#555",
      accent: "#0a84ff",
      statusSuccess: "#00ff00",
      statusWarning: "#ff9500",
      statusDanger: "#ff0000",
      palette: { red: { 300: "#ff6b6b" }, white: "#fff" },
    },
  },
  snapshotState: {
    entries: undefined as ProviderSnapshotEntry[] | undefined,
    isLoading: false,
    isRefreshing: false,
  },
  configState: {
    config: null as MutableDaemonConfig | null,
  },
  patchConfigMock: vi.fn(async () => undefined),
  openProviderSettingsMock: vi.fn(),
  hostFeatures: {
    providerRemoval: false,
    providerAccounts: false,
  },
  createProviderAccountMock: vi.fn(),
  loginProviderAccountMock: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Alert: { alert: vi.fn() },
  View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement("div", { "data-testid": testID }, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("span", null, children),
  TextInput: ({
    value,
    onChangeText,
    placeholder,
    testID,
  }: {
    value?: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
    testID?: string;
  }) =>
    React.createElement("input", {
      "data-testid": testID,
      value: value ?? "",
      placeholder,
      onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
    }),
  Pressable: ({
    children,
    onPress,
    onHoverIn,
    onHoverOut,
    accessibilityRole,
    accessibilityLabel,
    disabled,
    testID,
  }: {
    children?:
      | React.ReactNode
      | ((state: { pressed: boolean; hovered: boolean }) => React.ReactNode);
    onPress?: (event: React.MouseEvent) => void;
    onHoverIn?: () => void;
    onHoverOut?: () => void;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    disabled?: boolean;
    testID?: string;
  }) =>
    React.createElement(
      "div",
      {
        role: accessibilityRole,
        "aria-label": accessibilityLabel,
        "aria-disabled": disabled ? "true" : undefined,
        "data-testid": testID,
        onClick: disabled ? undefined : onPress,
        onMouseEnter: onHoverIn,
        onMouseLeave: onHoverOut,
      },
      typeof children === "function" ? children({ pressed: false, hovered: false }) : children,
    ),
  ActivityIndicator: () => React.createElement("span", { "data-testid": "activity-indicator" }),
}));

vi.mock("react-native-unistyles", () => ({
  StyleSheet: {
    create: (factory: unknown) =>
      typeof factory === "function" ? (factory as (t: typeof theme) => unknown)(theme) : factory,
  },
  useUnistyles: () => ({ theme, rt: { breakpoint: "md" } }),
  withUnistyles: (Component: unknown) => Component,
}));

vi.mock("lucide-react-native", () => {
  const icon = (name: string) => () => React.createElement("span", { "data-icon": name });
  return {
    Copy: icon("Copy"),
    ExternalLink: icon("ExternalLink"),
    GripVertical: icon("GripVertical"),
    LogIn: icon("LogIn"),
    LogOut: icon("LogOut"),
    MoreVertical: icon("MoreVertical"),
    Pencil: icon("Pencil"),
    RefreshCw: icon("RefreshCw"),
    Trash2: icon("Trash2"),
  };
});

vi.mock("@/components/draggable-list", () => ({
  DraggableList: ({
    data,
    keyExtractor,
    renderItem,
    onDragEnd,
    testID,
  }: {
    data: unknown[];
    keyExtractor: (item: unknown, index: number) => string;
    renderItem: (info: {
      item: unknown;
      index: number;
      drag: () => void;
      isActive: boolean;
      dragHandleProps?: {
        attributes?: Record<string, unknown>;
        listeners?: Record<string, unknown>;
        setActivatorNodeRef?: (node: unknown) => void;
      };
    }) => React.ReactElement;
    onDragEnd: (data: unknown[]) => void;
    testID?: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": testID },
      data.map((item, index) =>
        React.createElement(
          React.Fragment,
          { key: keyExtractor(item, index) },
          renderItem({
            item,
            index,
            drag: () => undefined,
            isActive: false,
            dragHandleProps: {
              attributes: {},
              listeners: {},
              setActivatorNodeRef: () => undefined,
            },
          }),
        ),
      ),
      React.createElement("button", {
        type: "button",
        "data-testid": "provider-list-simulate-reorder",
        onClick: () => {
          if (data.length < 2) return;
          const next = [...data];
          const [first] = next.splice(0, 1);
          next.push(first);
          onDragEnd(next);
        },
      }),
    ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown-menu" }, children),
  DropdownMenuTrigger: ({
    children,
    onPressIn,
    accessibilityRole,
    accessibilityLabel,
    testID,
  }: {
    children?:
      | React.ReactNode
      | ((state: { pressed: boolean; hovered: boolean; open: boolean }) => React.ReactNode);
    onPressIn?: (event: { stopPropagation: () => void }) => void;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    testID?: string;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        role: accessibilityRole,
        "aria-label": accessibilityLabel,
        "data-testid": testID,
        onMouseDown: (event: React.MouseEvent) => onPressIn?.(event),
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
      },
      typeof children === "function"
        ? children({ pressed: false, hovered: false, open: false })
        : children,
    ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown-menu-content" }, children),
  DropdownMenuItem: ({
    children,
    onSelect,
    testID,
  }: {
    children?: React.ReactNode;
    onSelect?: () => void;
    testID?: string;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": testID,
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          onSelect?.();
        },
      },
      children,
    ),
  DropdownMenuSeparator: () => React.createElement("hr"),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      (
        ({
          "settings.providers.providerDetails": "{{name}} provider details",
          "settings.providers.enableProvider": "Enable {{name}}",
          "settings.providers.statuses.disabled": "Disabled",
          "settings.providers.statuses.available": "Available",
          "settings.providers.statuses.loading": "Loading",
          "settings.providers.statuses.error": "Error",
          "settings.providers.statuses.notInstalled": "Not installed",
          "settings.providers.models.one": "1 model",
          "settings.providers.models.many": "{{count}} models",
          "settings.providers.addErrorTitle": "Unable to add provider",
          "settings.providers.updateErrorTitle": "Unable to update provider",
          "settings.providers.emptyList": "Add a provider to get started.",
          "settings.providers.builtinProviders": "Built-in providers",
          "settings.providers.catalogProviders": "ACP catalog",
          "settings.providers.signInWithAccount": "Sign in with account",
          "settings.providers.useApiKey": "Use API key",
          "settings.providers.choosingAuth": "How should {{name}} authenticate?",
          "settings.providers.addingInstance": "Adding...",
          "settings.providers.actions.remove": "Remove",
          "settings.providers.actions.removing": "Removing...",
          "settings.providers.actions.login": "Log in",
          "settings.providers.accounts.loggingIn": "Starting login...",
          "settings.providers.accounts.signInForEmail": "Sign in to show email",
          "settings.providers.remove.confirmTitle": "Remove {{name}}?",
          "settings.providers.remove.confirmMessage":
            "This deletes the provider entry from config.json. It cannot be undone.",
          "settings.providers.remove.confirm": "Remove",
          "settings.providers.remove.errorTitle": "Unable to remove provider",
        })[key] ?? key
      )
        .replaceAll("{{name}}", String(values?.name ?? ""))
        .replaceAll("{{count}}", String(values?.count ?? "")),
  }),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    value,
    onValueChange,
    disabled,
    accessibilityLabel,
    testID,
  }: {
    value: boolean;
    onValueChange?: (next: boolean) => void;
    disabled?: boolean;
    accessibilityLabel?: string;
    testID?: string;
  }) =>
    React.createElement("div", {
      role: "switch",
      "aria-checked": value ? "true" : "false",
      "aria-disabled": disabled ? "true" : undefined,
      "aria-label": accessibilityLabel,
      "data-testid": testID ?? "provider-switch",
      onClick: (event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;
        onValueChange?.(!value);
      },
    }),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: () => React.createElement("span", { "data-testid": "loading-spinner" }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onPress,
    onPressIn,
    disabled,
    testID,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    onPressIn?: (event: { stopPropagation: () => void }) => void;
    disabled?: boolean;
    testID?: string;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": testID,
        disabled,
        onMouseDown: (event: React.MouseEvent) => onPressIn?.(event),
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation();
          if (disabled) return;
          onPress?.();
        },
      },
      children,
    ),
}));

vi.mock("@/contexts/toast-context", () => ({
  useToast: () => ({
    show: vi.fn(),
    error: vi.fn(),
    copied: vi.fn(),
  }),
}));

vi.mock("@/components/provider-icons", () => ({
  getProviderIcon: (provider: string) => () =>
    React.createElement("span", { "data-icon": `provider-${provider}` }),
}));

vi.mock("@/stores/provider-settings-store", () => ({
  useProviderSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ open: openProviderSettingsMock }),
}));

vi.mock("@/components/provider-catalog-list", () => ({
  ProviderCatalogList: () => null,
}));

vi.mock("@/components/rename-modal", () => ({
  AdaptiveRenameModal: ({
    visible,
    title,
    testID,
  }: {
    visible: boolean;
    title?: string;
    testID?: string;
  }) =>
    visible ? React.createElement("div", { "data-testid": testID ?? "rename-modal" }, title) : null,
}));

vi.mock("@/hooks/use-providers-snapshot", () => ({
  useProvidersSnapshot: () => ({
    entries: snapshotState.entries,
    isLoading: snapshotState.isLoading,
    isFetching: false,
    isRefreshing: snapshotState.isRefreshing,
    error: null,
    supportsSnapshot: true,
    refresh: vi.fn(async () => {}),
    refetchIfStale: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-daemon-config", () => ({
  useDaemonConfig: () => ({
    config: configState.config,
    isLoading: false,
    patchConfig: patchConfigMock,
  }),
}));

vi.mock("@/runtime/host-runtime", () => ({
  useHostRuntimeIsConnected: () => true,
  useHostRuntimeClient: () => ({
    createProviderAccount: createProviderAccountMock,
    loginProviderAccount: loginProviderAccountMock,
  }),
}));

vi.mock("@/runtime/host-features", () => ({
  useHostFeature: (_serverId: string, feature: keyof typeof hostFeatures) =>
    hostFeatures[feature] ?? false,
}));

vi.mock("@/utils/confirm-dialog", () => ({
  confirmDialog: vi.fn(async () => true),
}));

vi.mock("@/utils/open-external-url", () => ({
  openExternalUrl: vi.fn(async () => undefined),
}));

vi.mock("@/utils/copy-to-clipboard", () => ({
  copyToClipboard: vi.fn(async () => undefined),
}));

import { ProvidersSection } from "./providers-section";

const claudeEntry: ProviderSnapshotEntry = {
  provider: "claude",
  status: "ready",
  enabled: true,
  label: "Claude",
  description: "Claude Code",
  defaultModeId: null,
  modes: [],
  models: [
    { provider: "claude", id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { provider: "claude", id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { provider: "claude", id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
};

const disabledCodexEntry: ProviderSnapshotEntry = {
  provider: "codex",
  status: "unavailable",
  enabled: false,
  label: "Codex",
  description: "OpenAI Codex",
  defaultModeId: null,
  modes: [],
};

function makeConfig(providers: MutableDaemonConfig["providers"] = {}): MutableDaemonConfig {
  return {
    relay: { enabled: false },
    mcp: { injectIntoAgents: false },
    browserTools: { enabled: false },
    providers,
    metadataGeneration: { providers: [] },
    autoArchiveAfterMerge: false,
    enableTerminalAgentHooks: false,
    appendSystemPrompt: "",
  };
}

function descendants(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>("*"));
}

function indexOfMatches(nodes: HTMLElement[], selector: string): number {
  return nodes.findIndex((node) => node.matches(selector));
}

function indexOfText(nodes: HTMLElement[], text: string): number {
  return nodes.findIndex((node) => node.textContent?.trim() === text);
}

describe("ProvidersSection", () => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;

  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    snapshotState.entries = undefined;
    snapshotState.isLoading = false;
    snapshotState.isRefreshing = false;
    configState.config = null;
    hostFeatures.providerRemoval = false;
    hostFeatures.providerAccounts = false;
    patchConfigMock.mockReset();
    patchConfigMock.mockResolvedValue(undefined);
    openProviderSettingsMock.mockReset();
    createProviderAccountMock.mockReset();
    loginProviderAccountMock.mockReset();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container?.remove();
    container = null;
    vi.unstubAllGlobals();
  });

  function render(): void {
    act(() => {
      root?.render(<ProvidersSection serverId="server-1" />);
    });
  }

  function findRow(accessibilityLabel: string): HTMLElement {
    const pressable = container?.querySelector<HTMLElement>(
      `[role="button"][aria-label="${accessibilityLabel}"]`,
    );
    if (!pressable) throw new Error(`Expected row with aria-label "${accessibilityLabel}"`);
    const row = pressable.closest<HTMLElement>('[data-testid^="provider-row-"]') ?? pressable;
    return row;
  }

  it("renders the disabled provider with its server-provided label in snapshot order", () => {
    snapshotState.entries = [claudeEntry, disabledCodexEntry];
    configState.config = makeConfig({ codex: { enabled: false } });

    render();

    const rows = Array.from(
      container?.querySelectorAll<HTMLElement>('[role="button"][aria-label$="provider details"]') ??
        [],
    );
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Claude provider details",
      "Codex provider details",
    ]);

    const codexRow = findRow("Codex provider details");
    const codexNodes = descendants(codexRow);
    expect(indexOfText(codexNodes, "Codex")).toBeGreaterThanOrEqual(0);
    expect(indexOfText(codexNodes, "codex")).toBe(-1);
    expect(indexOfText(codexNodes, "Disabled")).toBeGreaterThanOrEqual(0);
  });

  it("composes the row as drag handle, icon, label, status, model count, then switch", () => {
    snapshotState.entries = [claudeEntry];
    configState.config = makeConfig();

    render();

    const row = findRow("Claude provider details");
    const nodes = descendants(row);
    const dragHandle = indexOfMatches(nodes, '[data-testid="provider-drag-handle-claude"]');
    const grip = indexOfMatches(nodes, '[data-icon="GripVertical"]');
    const icon = indexOfMatches(nodes, '[data-icon="provider-claude"]');
    const label = indexOfText(nodes, "Claude");
    const status = indexOfText(nodes, "Available");
    const modelCount = indexOfText(nodes, "3 models");
    const switchEl = indexOfMatches(nodes, '[role="switch"]');

    expect(dragHandle).toBeGreaterThanOrEqual(0);
    expect(grip).toBeGreaterThanOrEqual(0);
    expect(icon).toBeGreaterThan(dragHandle);
    expect(label).toBeGreaterThan(icon);
    expect(status).toBeGreaterThan(label);
    expect(modelCount).toBeGreaterThan(status);
    expect(switchEl).toBeGreaterThan(modelCount);
  });

  it("opens the diagnostic sheet when the outer row is pressed for a disabled provider", () => {
    snapshotState.entries = [disabledCodexEntry];
    configState.config = makeConfig({ codex: { enabled: false } });

    render();

    expect(openProviderSettingsMock).not.toHaveBeenCalled();

    const row = container?.querySelector<HTMLElement>(
      '[role="button"][aria-label="Codex provider details"]',
    );
    expect(row).not.toBeNull();
    act(() => {
      row?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    expect(openProviderSettingsMock).toHaveBeenCalledTimes(1);
    expect(openProviderSettingsMock).toHaveBeenCalledWith({
      serverId: "server-1",
      provider: "codex",
    });
  });

  it("toggles the provider enabled flag through patchConfig when the switch is pressed", async () => {
    snapshotState.entries = [claudeEntry];
    configState.config = makeConfig();

    render();

    const row = findRow("Claude provider details");
    const switchEl = row.querySelector<HTMLElement>('[role="switch"]');
    expect(switchEl).not.toBeNull();
    expect(switchEl?.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      switchEl?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    expect(patchConfigMock).toHaveBeenCalledTimes(1);
    expect(patchConfigMock).toHaveBeenCalledWith({
      providers: { claude: { enabled: false } },
    });
  });

  it("rewrites provider order through patchConfig when a row is dragged", async () => {
    snapshotState.entries = [claudeEntry, disabledCodexEntry];
    configState.config = makeConfig({ codex: { enabled: false } });

    render();

    expect(container?.querySelector('[data-testid="provider-drag-handle-claude"]')).not.toBeNull();

    const simulateReorder = container?.querySelector<HTMLButtonElement>(
      '[data-testid="provider-list-simulate-reorder"]',
    );
    expect(simulateReorder).not.toBeNull();

    await act(async () => {
      simulateReorder?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    expect(patchConfigMock).toHaveBeenCalledWith({
      providers: {
        codex: { order: 0 },
        claude: { order: 1 },
      },
    });
  });

  it("shows account instance label with company as same-line subtitle", () => {
    hostFeatures.providerAccounts = true;
    snapshotState.entries = [
      {
        provider: "codex-codex-account",
        status: "ready",
        enabled: true,
        label: "Codex account",
        description: "OpenAI Codex",
        defaultModeId: null,
        modes: [],
        accountBase: "codex",
        accountEmail: "jason@usenash.com",
        source: "custom",
      },
    ];
    configState.config = makeConfig({
      "codex-codex-account": {
        extends: "codex",
        label: "Codex account",
        enabled: true,
        env: { VINCU_PROVIDER_ACCOUNT: "1" },
      },
    });

    render();

    const row = findRow("Codex account, Codex, jason@usenash.com provider details");
    const nodes = descendants(row);
    const label = indexOfText(nodes, "Codex account");
    const company = indexOfText(nodes, "Codex");
    expect(label).toBeGreaterThanOrEqual(0);
    expect(company).toBeGreaterThan(label);
  });

  it("puts rename for unsigned accounts in the three-dot menu", () => {
    hostFeatures.providerAccounts = true;
    snapshotState.entries = [
      {
        provider: "cursor-cursor-account",
        status: "unavailable",
        enabled: false,
        label: "Cursor account",
        description: "Cursor",
        defaultModeId: null,
        modes: [],
        accountBase: "cursor",
        source: "custom",
      },
    ];
    configState.config = makeConfig({
      "cursor-cursor-account": {
        extends: "cursor",
        label: "Cursor account",
        enabled: false,
        env: { VINCU_PROVIDER_ACCOUNT: "1" },
      },
    });

    render();

    expect(
      container?.querySelector('[data-testid="provider-account-menu-cursor-cursor-account"]'),
    ).not.toBeNull();
    expect(
      container?.querySelector('[data-testid="provider-rename-cursor-cursor-account"]'),
    ).not.toBeNull();
    expect(
      container?.querySelector('[data-testid="provider-login-cursor-cursor-account"]'),
    ).not.toBeNull();
  });

  it("shows empty-state copy when there are no provider instances", () => {
    snapshotState.entries = [];
    configState.config = makeConfig();
    hostFeatures.providerAccounts = true;

    render();

    expect(container?.textContent).toContain("Add a provider to get started.");
    expect(container?.querySelector('[data-testid="host-page-provider-accounts-card"]')).toBeNull();
    expect(container?.querySelector('[data-testid="provider-add-builtin-claude"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="provider-add-builtin-cursor"]')).not.toBeNull();
  });

  it("routes Claude add through Sign in vs API key chooser", async () => {
    snapshotState.entries = [];
    configState.config = makeConfig();
    hostFeatures.providerAccounts = true;
    createProviderAccountMock.mockResolvedValue({
      providerId: "claude-account",
      error: null,
    });
    loginProviderAccountMock.mockResolvedValue({
      error: null,
      loginUrl: "https://example.com/login",
      loginCode: null,
    });

    render();

    const claudeAdd = container?.querySelector<HTMLButtonElement>(
      '[data-testid="provider-add-builtin-claude"]',
    );
    expect(claudeAdd).not.toBeNull();
    await act(async () => {
      claudeAdd?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    expect(container?.querySelector('[data-testid="provider-add-auth-sign-in"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="provider-add-auth-api-key"]')).not.toBeNull();

    await act(async () => {
      container
        ?.querySelector<HTMLButtonElement>('[data-testid="provider-add-auth-sign-in"]')
        ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    expect(createProviderAccountMock).toHaveBeenCalledWith({
      base: "claude",
      label: "Claude account",
      authMode: "oauth",
    });
    expect(loginProviderAccountMock).toHaveBeenCalledWith({ providerId: "claude-account" });
  });
});
