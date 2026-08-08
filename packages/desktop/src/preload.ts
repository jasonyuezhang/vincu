import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { BrowserKeyboardPolicy } from "./features/browser-keyboard/index.js";

// This preload runs in Electron's sandbox and is tsc-compiled (not bundled), so it MUST
// NOT emit any runtime module load other than "electron" — a require() of a local or
// third-party module throws and aborts the preload before exposeInMainWorld runs, leaving
// window.vincuDesktop undefined (the 0.1.108 regression, #2103). Keep this literal in sync
// with VINCU_BROWSER_PROFILE_PARTITION in features/browser-profile.ts; preload-sandbox.test.ts
// guards both the no-local-import rule and this drift. Type-only imports are fine (erased at emit).
const VINCU_BROWSER_PROFILE_PARTITION = "persist:vincu-browser";

type EventHandler = (payload: unknown) => void;

interface AttachedBrowserRegistration {
  browserId: string;
  workspaceId: string;
  webContentsId: number;
}

contextBridge.exposeInMainWorld("vincuDesktop", {
  platform: process.platform,
  invoke: (command: string, args?: Record<string, unknown>) =>
    ipcRenderer.invoke("vincu:invoke", command, args),
  getPendingOpenProject: () =>
    ipcRenderer.invoke("vincu:get-pending-open-project") as Promise<string | null>,
  agentNavigation: {
    ready: () =>
      ipcRenderer.invoke("vincu:agent-navigation:ready") as Promise<{
        serverId: string;
        agentId: string;
      } | null>,
  },
  events: {
    on: (event: string, handler: EventHandler): Promise<() => void> => {
      const listener = (_ipcEvent: Electron.IpcRendererEvent, payload: unknown) => {
        handler(payload);
      };
      ipcRenderer.on(`vincu:event:${event}`, listener);
      return Promise.resolve(() => {
        ipcRenderer.removeListener(`vincu:event:${event}`, listener);
      });
    },
  },
  window: {
    openNew: (options?: { pendingOpenProjectPath?: string | null }) =>
      ipcRenderer.invoke("vincu:window:openNew", options),
    getCurrentWindow: () => ({
      toggleMaximize: () => ipcRenderer.invoke("vincu:window:toggleMaximize"),
      setFullscreen: (fullscreen: boolean) =>
        ipcRenderer.invoke("vincu:window:setFullscreen", fullscreen),
      isFullscreen: () => ipcRenderer.invoke("vincu:window:isFullscreen"),
      updateWindowControls: (update: {
        height?: number;
        backgroundColor?: string;
        foregroundColor?: string;
        trafficLightOffsetY?: number;
      }) => ipcRenderer.invoke("vincu:window:updateWindowControls", update),
      onResized: (handler: EventHandler): (() => void) => {
        const listener = (_ipcEvent: Electron.IpcRendererEvent, payload: unknown) => {
          handler(payload);
        };
        ipcRenderer.on("vincu:window:resized", listener);
        return () => {
          ipcRenderer.removeListener("vincu:window:resized", listener);
        };
      },
      setBadgeCount: (count?: number) => ipcRenderer.invoke("vincu:window:setBadgeCount", count),
    }),
  },
  dialog: {
    ask: (message: string, options?: Record<string, unknown>) =>
      ipcRenderer.invoke("vincu:dialog:ask", message, options),
    askWithCheckbox: (message: string, options: Record<string, unknown>) =>
      ipcRenderer.invoke("vincu:dialog:askWithCheckbox", message, options),
    open: (options?: Record<string, unknown>) => ipcRenderer.invoke("vincu:dialog:open", options),
  },
  notification: {
    isSupported: () => ipcRenderer.invoke("vincu:notification:isSupported"),
    sendNotification: (payload: { title: string; body?: string; data?: Record<string, unknown> }) =>
      ipcRenderer.invoke("vincu:notification:send", payload),
  },
  opener: {
    openUrl: (url: string) => ipcRenderer.invoke("vincu:opener:openUrl", url),
  },
  editor: {
    listTargets: () => ipcRenderer.invoke("vincu:editor:listTargets"),
    openTarget: (input: {
      editorId: string;
      workspacePath: string;
      filePath?: string;
      line?: number;
      column?: number;
    }) => ipcRenderer.invoke("vincu:editor:openTarget", input),
  },
  webUtils: {
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
  },
  menu: {
    showContextMenu: (input?: Record<string, unknown>) =>
      ipcRenderer.invoke("vincu:menu:showContextMenu", input),
    setCapturingShortcut: (capturing: boolean) =>
      ipcRenderer.invoke("vincu:menu:set-capturing-shortcut", capturing),
  },
  browser: {
    setShortcutPolicy: (input: BrowserKeyboardPolicy) =>
      ipcRenderer.invoke("vincu:browser:set-shortcut-policy", input),
    profilePartition: VINCU_BROWSER_PROFILE_PARTITION,
    registerAttachedBrowser: (input: AttachedBrowserRegistration) =>
      ipcRenderer.invoke("vincu:browser:register-attached", input),
    unregisterWorkspaceBrowser: (browserId: string) =>
      ipcRenderer.invoke("vincu:browser:unregister-workspace-browser", browserId),
    setWorkspaceActiveBrowser: (input: { workspaceId: string; browserId: string | null }) =>
      ipcRenderer.invoke("vincu:browser:set-workspace-active-browser", input),
    focus: (browserId: string) => ipcRenderer.invoke("vincu:browser:focus", browserId),
    openDevTools: (browserId: string) =>
      ipcRenderer.invoke("vincu:browser:open-devtools", browserId),
    clearProfile: (legacyBrowserIds: string[]) =>
      ipcRenderer.invoke("vincu:browser:clear-profile", legacyBrowserIds),
    executeAutomationCommand: (request: Record<string, unknown>) =>
      ipcRenderer.invoke("vincu:browser:execute-automation-command", request),
    captureElement: (
      browserId: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => ipcRenderer.invoke("vincu:browser:capture-element", browserId, rect),
    copyElement: (payload: { text?: string; imageDataUrl?: string }) =>
      ipcRenderer.invoke("vincu:browser:copy-element", payload),
  },
});
