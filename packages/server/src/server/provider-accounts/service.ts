import { existsSync, promises as fs, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import type { Logger } from "pino";
import type { ProviderAccountAuthStatus, ProviderAccountBase } from "@getvincu/protocol/messages";
import { ensurePrivateDirectory } from "../private-files.js";
import type { DaemonConfigStore } from "../daemon-config-store.js";
import {
  createProviderEnvSpec,
  type ProviderOverride,
  type ProviderRuntimeSettings,
} from "../agent/provider-launch-config.js";
import { findExecutable } from "../../executable-resolution/executable-resolution.js";
import { execCommand, spawnProcess } from "../../utils/spawn.js";
import {
  allocateProviderAccountId,
  buildProviderAccountEnv,
  isProviderAccountOverride,
  providerAccountHomePath,
  resolveProviderAccountHome,
} from "./homes.js";
import { BUILTIN_PROVIDER_IDS } from "@getvincu/protocol/provider-manifest";
import {
  apiKeyEnvForProviderBase,
  isProviderAccountBase,
  PROVIDER_ACCOUNT_BASES,
  VINCU_PROVIDER_ACCOUNT_ENV,
} from "./constants.js";
import { hasProviderAccountCredentials, providerAccountCredentialPath } from "./credentials.js";
import {
  clearProviderAccountIdentity,
  parseClaudeAuthStatusOutput,
  parseCursorStatusOutput,
  readProviderAccountEmail,
  writeProviderAccountIdentity,
} from "./identity.js";
import {
  buildProviderAccountLoginMessage,
  parseProviderAccountLoginOutput,
  type ProviderAccountLoginHints,
} from "./login-output.js";

const BUILTIN_PROVIDER_IDS_FOR_ADD = new Set(BUILTIN_PROVIDER_IDS);

const LOGIN_HINT_WAIT_MS = 5_000;
/** Survives daemon restarts so orphaned detached `login` children can be reaped. */
const LOGIN_PID_FILENAME = ".vincu-login.pid";

function loginPidPath(homePath: string): string {
  return path.join(homePath, LOGIN_PID_FILENAME);
}

function writeLoginPid(homePath: string, pid: number): void {
  try {
    // Best-effort; login still works if the pid file cannot be written.
    writeFileSync(loginPidPath(homePath), `${pid}\n`, { mode: 0o600 });
  } catch {
    // ignore
  }
}

function readLoginPid(homePath: string): number | null {
  try {
    const raw = readFileSync(loginPidPath(homePath), "utf8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function clearLoginPid(homePath: string): void {
  try {
    unlinkSync(loginPidPath(homePath));
  } catch {
    // ignore
  }
}

/** Kill a detached login session (own process group) then the pid itself. */
function killLoginPid(pid: number): void {
  if (process.platform !== "win32") {
    try {
      process.kill(-pid, "SIGTERM");
      return;
    } catch {
      // Not a process group leader or already gone — fall through.
    }
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
}

export interface ProviderAccountError {
  code: string;
  message: string;
}

export interface ProviderAccountRecord {
  providerId: string;
  base: ProviderAccountBase;
  label: string;
  homePath: string;
}

export interface ProviderInstanceRecord {
  providerId: string;
  base: string;
  label: string;
  homePath: string | null;
  authMode: "oauth" | "api_key";
}

export interface ProviderAccountsServiceOptions {
  vincuHome: string;
  daemonConfigStore: DaemonConfigStore;
  logger: Logger;
  resolveLaunchCommand?: (base: ProviderAccountBase) => Promise<{
    command: string;
    args: string[];
  }>;
}

async function resolveCursorAgentCommand(): Promise<string | null> {
  const fromPath = await findExecutable("cursor-agent");
  if (fromPath) {
    return fromPath;
  }
  const home = process.env.HOME?.trim();
  if (!home) {
    return null;
  }
  // Official install puts the binary here; daemons often miss ~/.local/bin on PATH.
  const wellKnown = path.join(home, ".local", "bin", "cursor-agent");
  return existsSync(wellKnown) ? wellKnown : null;
}

async function defaultResolveLaunchCommand(
  base: ProviderAccountBase,
): Promise<{ command: string; args: string[] }> {
  if (base === "claude") {
    return { command: "claude", args: [] };
  }
  if (base === "codex") {
    return { command: "codex", args: [] };
  }
  const cursorCommand = await resolveCursorAgentCommand();
  return { command: cursorCommand ?? "cursor-agent", args: [] };
}

async function ensureCursorAgentCommand(command: string): Promise<string | null> {
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command) ? command : null;
  }
  if (command === "cursor-agent") {
    return resolveCursorAgentCommand();
  }
  return findExecutable(command);
}

const CURSOR_AGENT_INSTALL_HINT =
  "cursor-agent is not installed (or not visible to the daemon). Install it with `curl https://cursor.com/install -fsS | bash`, then try Log in again.";

function formatLoginExitedWithoutUrl(detail: string): string {
  if (detail.length === 0) {
    return "Login exited before producing a sign-in URL.";
  }
  return `Login exited before producing a sign-in URL.\n${detail}`;
}

function formatCursorLoginFailure(detail: string): string {
  if (detail.length === 0 || /enoent|not found|cursor-agent/i.test(detail)) {
    return CURSOR_AGENT_INSTALL_HINT;
  }
  return formatLoginExitedWithoutUrl(detail);
}

async function resolveCursorLoginLaunch(launch: {
  command: string;
  args: string[];
}): Promise<{ command: string; args: string[] } | null> {
  const resolvedCursor = await ensureCursorAgentCommand(launch.command);
  if (!resolvedCursor) {
    return null;
  }
  return { ...launch, command: resolvedCursor };
}

function loginArgsForBase(base: ProviderAccountBase, launchArgs: string[]): string[] {
  if (base === "claude") {
    return [...launchArgs, "auth", "login"];
  }
  if (base === "codex") {
    // Codex browser login binds localhost on the host and often cannot open a GUI
    // browser from the daemon. Device auth returns a URL + code the app can show.
    return [...launchArgs, "login", "--device-auth"];
  }
  return [...launchArgs, "login"];
}

function logoutArgsForBase(base: ProviderAccountBase, launchArgs: string[]): string[] {
  if (base === "claude") {
    return [...launchArgs, "auth", "logout"];
  }
  return [...launchArgs, "logout"];
}

function toRuntimeSettings(override: ProviderOverride): ProviderRuntimeSettings {
  return {
    ...(override.command ? { command: { mode: "replace" as const, argv: override.command } } : {}),
    ...(override.env ? { env: override.env } : {}),
    ...(override.disallowedTools ? { disallowedTools: override.disallowedTools } : {}),
  };
}

function readProviders(store: DaemonConfigStore): Record<string, ProviderOverride> {
  const providers = store.get().providers;
  if (!providers) {
    return {};
  }
  const result: Record<string, ProviderOverride> = {};
  for (const [providerId, value] of Object.entries(providers)) {
    result[providerId] = value as ProviderOverride;
  }
  return result;
}

function collectLoginHints(
  child: ChildProcess,
  options: { requireCode: boolean; timeoutMs: number },
): Promise<{ hints: ProviderAccountLoginHints; output: string; exited: boolean }> {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      child.stdout?.off("data", onChunk);
      child.stderr?.off("data", onChunk);
      child.off("error", onExitLike);
      child.off("exit", onExitLike);
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = (exited: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve({
        hints: parseProviderAccountLoginOutput(output),
        output,
        exited,
      });
    };

    const consider = () => {
      const hints = parseProviderAccountLoginOutput(output);
      if (hints.loginUrl && (!options.requireCode || hints.loginCode)) {
        finish(false);
      }
    };

    const onChunk = (chunk: Buffer | string) => {
      output += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      consider();
    };

    const onExitLike = () => {
      finish(true);
    };

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.once("error", onExitLike);
    child.once("exit", onExitLike);
    timer = setTimeout(() => finish(false), options.timeoutMs);
  });
}

export class ProviderAccountsService {
  private readonly vincuHome: string;
  private readonly daemonConfigStore: DaemonConfigStore;
  private readonly logger: Logger;
  private readonly resolveLaunchCommand: (base: ProviderAccountBase) => Promise<{
    command: string;
    args: string[];
  }>;
  private readonly loginChildren = new Map<string, ReturnType<typeof spawnProcess>>();
  private readonly loginHints = new Map<string, ProviderAccountLoginHints>();
  private readonly promotedAfterAuth = new Set<string>();

  constructor(options: ProviderAccountsServiceOptions) {
    this.vincuHome = options.vincuHome;
    this.daemonConfigStore = options.daemonConfigStore;
    this.logger = options.logger.child({ module: "provider-accounts" });
    this.resolveLaunchCommand = options.resolveLaunchCommand ?? defaultResolveLaunchCommand;
  }

  listAccounts(): ProviderAccountRecord[] {
    const providers = readProviders(this.daemonConfigStore);
    const accounts: ProviderAccountRecord[] = [];
    for (const [providerId, override] of Object.entries(providers)) {
      if (!isProviderAccountOverride(override, this.vincuHome)) {
        continue;
      }
      const base = override.extends;
      if (!base || !isProviderAccountBase(base)) {
        continue;
      }
      const homePath = resolveProviderAccountHome(override, base, {
        vincuHome: this.vincuHome,
        providerId,
      });
      if (!homePath) {
        continue;
      }
      accounts.push({
        providerId,
        base,
        label: override.label ?? providerId,
        homePath,
      });
    }
    return accounts;
  }

  async createAccount(input: {
    base: string;
    label: string;
    authMode?: "oauth" | "api_key";
    apiKey?: string;
  }): Promise<{ account: ProviderInstanceRecord } | { error: ProviderAccountError }> {
    const label = input.label.trim();
    if (label.length === 0) {
      return { error: { code: "invalid_label", message: "Account label is required." } };
    }

    const authMode = input.authMode ?? "oauth";
    const base = input.base.trim();
    if (authMode === "oauth") {
      if (!isProviderAccountBase(base)) {
        return {
          error: {
            code: "invalid_base",
            message: `OAuth accounts require one of: ${PROVIDER_ACCOUNT_BASES.join(", ")}.`,
          },
        };
      }
      return this.createOauthAccount({ base, label });
    }

    return this.createApiKeyProfile({ base, label, apiKey: input.apiKey });
  }

  private async createOauthAccount(input: {
    base: ProviderAccountBase;
    label: string;
  }): Promise<{ account: ProviderInstanceRecord } | { error: ProviderAccountError }> {
    const existing = readProviders(this.daemonConfigStore);
    const providerId = allocateProviderAccountId({
      base: input.base,
      label: input.label,
      existingIds: new Set(Object.keys(existing)),
    });
    const homePath = providerAccountHomePath(this.vincuHome, providerId);
    ensurePrivateDirectory(homePath);

    try {
      this.daemonConfigStore.patch({
        providers: {
          [providerId]: {
            extends: input.base,
            label: input.label,
            enabled: false,
            env: buildProviderAccountEnv(input.base, homePath),
          },
        },
      });
    } catch (error) {
      await fs.rm(homePath, { recursive: true, force: true }).catch(() => undefined);
      return {
        error: {
          code: "config_patch_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    return {
      account: {
        providerId,
        base: input.base,
        label: input.label,
        homePath,
        authMode: "oauth",
      },
    };
  }

  private async createApiKeyProfile(input: {
    base: string;
    label: string;
    apiKey?: string;
  }): Promise<{ account: ProviderInstanceRecord } | { error: ProviderAccountError }> {
    const keyEnv = apiKeyEnvForProviderBase(input.base);
    if (
      !keyEnv &&
      input.base !== "copilot" &&
      input.base !== "opencode" &&
      input.base !== "pi" &&
      input.base !== "omp"
    ) {
      // Allow enable-only stubs for builtins without a dedicated API key env.
      if (!BUILTIN_PROVIDER_IDS_FOR_ADD.has(input.base)) {
        return {
          error: {
            code: "invalid_base",
            message: `Unknown provider base "${input.base}".`,
          },
        };
      }
    }

    const existing = readProviders(this.daemonConfigStore);
    const providerId = allocateProviderAccountId({
      base: input.base,
      label: input.label,
      existingIds: new Set(Object.keys(existing)),
    });
    const apiKey = input.apiKey?.trim() ?? "";
    const env: Record<string, string> = {};
    if (keyEnv && apiKey.length > 0) {
      env[keyEnv] = apiKey;
    }
    const enabled = keyEnv ? apiKey.length > 0 : true;

    try {
      this.daemonConfigStore.patch({
        providers: {
          [providerId]: {
            extends: input.base,
            label: input.label,
            enabled,
            ...(Object.keys(env).length > 0 ? { env } : {}),
          },
        },
      });
    } catch (error) {
      return {
        error: {
          code: "config_patch_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    return {
      account: {
        providerId,
        base: input.base,
        label: input.label,
        homePath: null,
        authMode: "api_key",
      },
    };
  }

  async startLogin(providerId: string): Promise<
    | {
        started: true;
        message: string;
        providerId: string;
        loginUrl: string | null;
        loginCode: string | null;
      }
    | { error: ProviderAccountError; providerId: string }
  > {
    const account = this.getAccount(providerId);
    if (!account) {
      return {
        providerId,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }

    const storedOverride = readProviders(this.daemonConfigStore)[providerId];
    if (!storedOverride) {
      return {
        providerId,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }
    const override: ProviderOverride = {
      ...storedOverride,
      env: {
        ...storedOverride.env,
        ...buildProviderAccountEnv(account.base, account.homePath),
      },
    };

    const existing = this.loginChildren.get(providerId);
    if (existing && existing.exitCode === null && !existing.killed) {
      const hints = this.loginHints.get(providerId) ?? {
        loginUrl: null,
        loginCode: null,
      };
      return {
        started: true,
        providerId,
        loginUrl: hints.loginUrl,
        loginCode: hints.loginCode,
        message: hints.loginUrl
          ? buildProviderAccountLoginMessage(hints)
          : "Login is already in progress. Complete it in the browser, then check status.",
      };
    }

    // Reap an orphaned detached login from a previous daemon before starting another.
    this.stopLoginChild(providerId, account.homePath);

    let launch = await this.resolveLaunchCommand(account.base);
    if (account.base === "cursor") {
      const resolvedLaunch = await resolveCursorLoginLaunch(launch);
      if (!resolvedLaunch) {
        return {
          providerId,
          error: {
            code: "login_spawn_failed",
            message: CURSOR_AGENT_INSTALL_HINT,
          },
        };
      }
      launch = resolvedLaunch;
    }
    const loginArgs = loginArgsForBase(account.base, launch.args);

    let child: ReturnType<typeof spawnProcess>;
    try {
      child = spawnProcess(launch.command, loginArgs, {
        cwd: account.homePath,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        ...createProviderEnvSpec({
          runtimeSettings: toRuntimeSettings(override),
          // Cursor opens a browser by default; force the printable URL for the app.
          overlays: account.base === "cursor" ? [{ NO_OPEN_BROWSER: "1" }] : undefined,
        }),
      });
      child.unref();
      this.loginChildren.set(providerId, child);
      if (typeof child.pid === "number") {
        writeLoginPid(account.homePath, child.pid);
      }
      child.once("exit", (code) => {
        if (this.loginChildren.get(providerId) === child) {
          this.loginChildren.delete(providerId);
        }
        clearLoginPid(account.homePath);
        this.logger.info({ providerId, code }, "Provider account login process exited");
      });
    } catch (error) {
      this.logger.warn({ err: error, providerId }, "Failed to start provider account login");
      const message = error instanceof Error ? error.message : String(error);
      return {
        providerId,
        error: {
          code: "login_spawn_failed",
          message:
            account.base === "cursor" && /enoent|not found/i.test(message)
              ? CURSOR_AGENT_INSTALL_HINT
              : message,
        },
      };
    }

    const collected = await collectLoginHints(child, {
      requireCode: account.base === "codex",
      timeoutMs: LOGIN_HINT_WAIT_MS,
    });
    this.loginHints.set(providerId, collected.hints);

    if (collected.exited && !collected.hints.loginUrl) {
      const detail = collected.output.trim().slice(-400);
      this.loginChildren.delete(providerId);
      this.loginHints.delete(providerId);
      return {
        providerId,
        error: {
          code: "login_spawn_failed",
          message:
            account.base === "cursor"
              ? formatCursorLoginFailure(detail)
              : formatLoginExitedWithoutUrl(detail),
        },
      };
    }

    return {
      started: true,
      providerId,
      loginUrl: collected.hints.loginUrl,
      loginCode: collected.hints.loginCode,
      message: buildProviderAccountLoginMessage(collected.hints),
    };
  }

  async getAccountStatus(providerId: string): Promise<{
    providerId: string;
    base: ProviderAccountBase | null;
    label: string | null;
    homePath: string | null;
    authStatus: ProviderAccountAuthStatus;
    email: string | null;
    detail: string | null;
    error: ProviderAccountError | null;
  }> {
    const account = this.getAccount(providerId);
    if (!account) {
      return {
        providerId,
        base: null,
        label: null,
        homePath: null,
        authStatus: "unknown",
        email: null,
        detail: null,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }

    const override = readProviders(this.daemonConfigStore)[providerId];
    if (!override) {
      return {
        providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: "unknown",
        email: readProviderAccountEmail({
          base: account.base,
          homePath: account.homePath,
        }),
        detail: null,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }

    const runtimeOverride: ProviderOverride = {
      ...override,
      env: {
        ...override.env,
        ...buildProviderAccountEnv(account.base, account.homePath),
      },
    };
    let status: Awaited<ReturnType<ProviderAccountsService["getAccountStatus"]>>;
    if (account.base === "claude") {
      status = await this.probeClaudeStatus(account, runtimeOverride);
    } else if (account.base === "codex") {
      status = await this.probeCodexStatus(account);
    } else {
      status = await this.probeCursorStatus(account, runtimeOverride);
    }

    if (status.authStatus === "authenticated") {
      // Detached login can keep holding CODEX_HOME sqlite locks after auth.json
      // is written; reap it before enable triggers a catalog probe.
      this.stopLoginChild(account.providerId, account.homePath);
      this.promoteAccountAfterAuth(account, override);
    }
    return status;
  }

  private promoteAccountAfterAuth(
    account: ProviderAccountRecord,
    override: ProviderOverride,
  ): void {
    if (override.enabled === true || this.promotedAfterAuth.has(account.providerId)) {
      return;
    }
    if (!hasProviderAccountCredentials(account.base, account.homePath)) {
      return;
    }
    this.promotedAfterAuth.add(account.providerId);
    try {
      // Force a config apply so the provider registry re-evaluates credential readiness.
      this.daemonConfigStore.patch({
        providers: {
          [account.providerId]: { enabled: true },
        },
      });
    } catch (error) {
      this.promotedAfterAuth.delete(account.providerId);
      this.logger.warn(
        { err: error, providerId: account.providerId },
        "Failed to enable provider account after auth",
      );
    }
  }

  async logoutAccount(
    providerId: string,
  ): Promise<
    { loggedOut: true; providerId: string } | { error: ProviderAccountError; providerId: string }
  > {
    const account = this.getAccount(providerId);
    if (!account) {
      return {
        providerId,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }

    const override = readProviders(this.daemonConfigStore)[providerId];
    if (!override) {
      return {
        providerId,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }

    this.stopLoginChild(providerId, account.homePath);
    await this.clearLocalAuth(account, override);

    try {
      this.daemonConfigStore.patch({
        providers: {
          [providerId]: { enabled: false },
        },
      });
    } catch (error) {
      return {
        providerId,
        error: {
          code: "config_patch_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    this.promotedAfterAuth.delete(providerId);
    return { loggedOut: true, providerId };
  }

  async removeAccount(
    providerId: string,
  ): Promise<
    { removed: true; providerId: string } | { error: ProviderAccountError; providerId: string }
  > {
    const account = this.getAccount(providerId);
    if (!account) {
      return {
        providerId,
        error: { code: "not_found", message: `Provider account "${providerId}" was not found.` },
      };
    }

    const override = readProviders(this.daemonConfigStore)[providerId];
    this.stopLoginChild(providerId, account.homePath);
    if (override) {
      await this.clearLocalAuth(account, override);
    }
    this.promotedAfterAuth.delete(providerId);

    try {
      this.daemonConfigStore.patch({ removeProviders: [providerId] });
    } catch (error) {
      return {
        providerId,
        error: {
          code: "config_patch_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    await fs.rm(account.homePath, { recursive: true, force: true }).catch((error) => {
      this.logger.warn(
        { err: error, providerId, homePath: account.homePath },
        "Failed to remove account home",
      );
    });

    return { removed: true, providerId };
  }

  private getAccount(providerId: string): ProviderAccountRecord | null {
    return this.listAccounts().find((account) => account.providerId === providerId) ?? null;
  }

  private stopLoginChild(providerId: string, homePath?: string | null): void {
    const child = this.loginChildren.get(providerId);
    const trackedPid = child?.pid;
    if (child && child.exitCode === null && !child.killed && typeof trackedPid === "number") {
      killLoginPid(trackedPid);
    } else if (homePath) {
      const persistedPid = readLoginPid(homePath);
      if (persistedPid !== null) {
        killLoginPid(persistedPid);
      }
    }
    if (homePath) {
      clearLoginPid(homePath);
    }
    this.loginChildren.delete(providerId);
    this.loginHints.delete(providerId);
  }

  private async clearLocalAuth(
    account: ProviderAccountRecord,
    override: ProviderOverride,
  ): Promise<void> {
    const runtimeOverride: ProviderOverride = {
      ...override,
      env: {
        ...override.env,
        ...buildProviderAccountEnv(account.base, account.homePath),
      },
    };
    const launch = await this.resolveLaunchCommand(account.base);
    const logoutArgs = logoutArgsForBase(account.base, launch.args);
    try {
      await execCommand(launch.command, logoutArgs, {
        cwd: account.homePath,
        timeout: 15_000,
        ...createProviderEnvSpec({ runtimeSettings: toRuntimeSettings(runtimeOverride) }),
      });
    } catch (error) {
      this.logger.warn(
        { err: error, providerId: account.providerId },
        "Provider CLI logout failed; clearing local credentials",
      );
    }

    await fs
      .rm(providerAccountCredentialPath(account.base, account.homePath), { force: true })
      .catch(() => undefined);
    if (account.base === "cursor") {
      await fs.rm(path.join(account.homePath, "auth.json"), { force: true }).catch(() => undefined);
      await fs
        .rm(path.join(account.homePath, "credentials"), { recursive: true, force: true })
        .catch(() => undefined);
    }
    await clearProviderAccountIdentity(account.homePath);
  }

  private async persistAccountEmail(
    account: ProviderAccountRecord,
    email: string | null,
  ): Promise<string | null> {
    if (!email) {
      return readProviderAccountEmail({
        base: account.base,
        homePath: account.homePath,
      });
    }
    await writeProviderAccountIdentity(account.homePath, { email }).catch((error) => {
      this.logger.warn(
        { err: error, providerId: account.providerId, homePath: account.homePath },
        "Failed to cache provider account email",
      );
    });
    return email;
  }

  private async probeClaudeStatus(
    account: ProviderAccountRecord,
    override: ProviderOverride,
  ): Promise<{
    providerId: string;
    base: ProviderAccountBase;
    label: string;
    homePath: string;
    authStatus: ProviderAccountAuthStatus;
    email: string | null;
    detail: string | null;
    error: ProviderAccountError | null;
  }> {
    const launch = await this.resolveLaunchCommand("claude");
    try {
      const result = await execCommand(launch.command, [...launch.args, "auth", "status"], {
        cwd: account.homePath,
        timeout: 8_000,
        ...createProviderEnvSpec({ runtimeSettings: toRuntimeSettings(override) }),
      });
      const detail = [result.stdout, result.stderr]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join("\n");
      const parsed = parseClaudeAuthStatusOutput(detail);
      const lower = detail.toLowerCase();
      const authenticated =
        parsed.authenticated ??
        (lower.includes("logged in") ||
          lower.includes("authenticated") ||
          (lower.includes("oauth") && !lower.includes("not logged")));
      const email = await this.persistAccountEmail(account, parsed.email);
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: authenticated ? "authenticated" : "unauthenticated",
        email,
        detail: detail || null,
        error: null,
      };
    } catch (error) {
      const credentialsPath = path.join(account.homePath, ".credentials.json");
      const email = await this.persistAccountEmail(account, null);
      if (existsSync(credentialsPath)) {
        return {
          providerId: account.providerId,
          base: account.base,
          label: account.label,
          homePath: account.homePath,
          authStatus: "authenticated",
          email,
          detail: null,
          error: null,
        };
      }
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: "unknown",
        email,
        detail: error instanceof Error ? error.message : String(error),
        error: null,
      };
    }
  }

  private async probeCodexStatus(account: ProviderAccountRecord): Promise<{
    providerId: string;
    base: ProviderAccountBase;
    label: string;
    homePath: string;
    authStatus: ProviderAccountAuthStatus;
    email: string | null;
    detail: string | null;
    error: ProviderAccountError | null;
  }> {
    const authPath = path.join(account.homePath, "auth.json");
    if (!existsSync(authPath)) {
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: "unauthenticated",
        email: null,
        detail: null,
        error: null,
      };
    }
    try {
      const raw = await fs.readFile(authPath, "utf8");
      const parsed = JSON.parse(raw) as { tokens?: { access_token?: string } };
      const authenticated = typeof parsed.tokens?.access_token === "string";
      const email = await this.persistAccountEmail(
        account,
        readProviderAccountEmail({ base: "codex", homePath: account.homePath }),
      );
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: authenticated ? "authenticated" : "unauthenticated",
        email,
        detail: null,
        error: null,
      };
    } catch (error) {
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: "unknown",
        email: readProviderAccountEmail({ base: "codex", homePath: account.homePath }),
        detail: error instanceof Error ? error.message : String(error),
        error: null,
      };
    }
  }

  private async probeCursorStatus(
    account: ProviderAccountRecord,
    override: ProviderOverride,
  ): Promise<{
    providerId: string;
    base: ProviderAccountBase;
    label: string;
    homePath: string;
    authStatus: ProviderAccountAuthStatus;
    email: string | null;
    detail: string | null;
    error: ProviderAccountError | null;
  }> {
    if (hasProviderAccountCredentials("cursor", account.homePath)) {
      const email = await this.persistAccountEmail(
        account,
        readProviderAccountEmail({ base: "cursor", homePath: account.homePath }),
      );
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: "authenticated",
        email,
        detail: null,
        error: null,
      };
    }

    const launch = await this.resolveLaunchCommand("cursor");
    try {
      const result = await execCommand(launch.command, [...launch.args, "status"], {
        cwd: account.homePath,
        timeout: 8_000,
        ...createProviderEnvSpec({ runtimeSettings: toRuntimeSettings(override) }),
      });
      const detail = [result.stdout, result.stderr]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join("\n");
      const parsed = parseCursorStatusOutput(detail);
      const email = await this.persistAccountEmail(account, parsed.email);
      let authStatus: ProviderAccountAuthStatus = "unknown";
      if (parsed.authenticated === true) {
        authStatus = "authenticated";
      } else if (parsed.authenticated === false) {
        authStatus = "unauthenticated";
      }
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus,
        email,
        detail: detail || null,
        error: null,
      };
    } catch (error) {
      return {
        providerId: account.providerId,
        base: account.base,
        label: account.label,
        homePath: account.homePath,
        authStatus: "unauthenticated",
        email: await this.persistAccountEmail(account, null),
        detail: error instanceof Error ? error.message : String(error),
        error: null,
      };
    }
  }
}

export function listAccountUsageHomes(
  vincuHome: string,
  providers: Record<string, ProviderOverride> | undefined,
): Array<{ providerId: string; base: ProviderAccountBase; label: string; homePath: string }> {
  if (!providers) {
    return [];
  }
  const homes: Array<{
    providerId: string;
    base: ProviderAccountBase;
    label: string;
    homePath: string;
  }> = [];
  for (const [providerId, override] of Object.entries(providers)) {
    if (!isProviderAccountOverride(override, vincuHome)) {
      continue;
    }
    const base = override.extends;
    if (!base || !isProviderAccountBase(base)) {
      continue;
    }
    const homePath = resolveProviderAccountHome(override, base, {
      vincuHome,
      providerId,
    });
    if (!homePath) {
      continue;
    }
    homes.push({
      providerId,
      base,
      label: override.label ?? providerId,
      homePath,
    });
  }
  return homes;
}

export { VINCU_PROVIDER_ACCOUNT_ENV };
