import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pino from "pino";
import { afterEach, describe, expect, test } from "vitest";

import { DaemonConfigStore } from "../daemon-config-store.js";
import { createProviderEnv } from "../agent/provider-launch-config.js";
import { ProviderAccountsService } from "./service.js";
import { providerAccountHomePath } from "./homes.js";

describe("ProviderAccountsService", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createService() {
    const vincuHome = mkdtempSync(path.join(tmpdir(), "vincu-provider-accounts-"));
    tempDirs.push(vincuHome);
    const daemonConfigStore = new DaemonConfigStore(vincuHome, {
      relay: { enabled: false },
      mcp: { injectIntoAgents: false },
      browserTools: { enabled: false },
      providers: {},
      metadataGeneration: { providers: [] },
      autoArchiveAfterMerge: false,
      enableTerminalAgentHooks: false,
      appendSystemPrompt: "",
    });
    const service = new ProviderAccountsService({
      vincuHome,
      daemonConfigStore,
      logger: pino({ level: "silent" }),
    });
    return { service, vincuHome, daemonConfigStore };
  }

  test("createAccount writes override and private home, removeAccount deletes both", async () => {
    const { service, vincuHome, daemonConfigStore } = createService();

    const created = await service.createAccount({
      base: "claude",
      label: "Personal",
    });
    expect("error" in created).toBe(false);
    if ("error" in created) {
      throw new Error(created.error.message);
    }

    expect(created.account.providerId).toBe("claude-personal");
    expect(created.account.homePath).toBe(providerAccountHomePath(vincuHome, "claude-personal"));
    expect(existsSync(created.account.homePath)).toBe(true);

    const override = daemonConfigStore.get().providers["claude-personal"];
    expect(override).toMatchObject({
      extends: "claude",
      label: "Personal",
      enabled: false,
      env: {
        VINCU_PROVIDER_ACCOUNT: "1",
        CLAUDE_CONFIG_DIR: created.account.homePath,
      },
    });

    const env = createProviderEnv({
      runtimeSettings: { env: override.env },
    });
    expect(env.CLAUDE_CONFIG_DIR).toBe(created.account.homePath);
    expect(env.VINCU_PROVIDER_ACCOUNT).toBe("1");

    const removed = await service.removeAccount("claude-personal");
    expect(removed).toEqual({ removed: true, providerId: "claude-personal" });
    expect(daemonConfigStore.get().providers["claude-personal"]).toBeUndefined();
    expect(existsSync(created.account.homePath)).toBe(false);
  });

  test("logoutAccount clears credentials and disables without deleting the home", async () => {
    const { service, daemonConfigStore } = createService();
    const created = await service.createAccount({
      base: "codex",
      label: "Work",
    });
    if ("error" in created) {
      throw new Error(created.error.message);
    }

    const authPath = path.join(created.account.homePath, "auth.json");
    writeFileSync(
      authPath,
      JSON.stringify({
        tokens: {
          access_token: "tok_test",
          id_token: `hdr.${Buffer.from(JSON.stringify({ email: "a@b.c" })).toString("base64url")}.sig`,
        },
      }),
      "utf8",
    );
    daemonConfigStore.patch({
      providers: {
        [created.account.providerId]: { enabled: true },
      },
    });

    const loggedOut = await service.logoutAccount(created.account.providerId);
    expect(loggedOut).toEqual({ loggedOut: true, providerId: created.account.providerId });
    expect(existsSync(authPath)).toBe(false);
    expect(existsSync(created.account.homePath)).toBe(true);
    expect(daemonConfigStore.get().providers[created.account.providerId]).toMatchObject({
      enabled: false,
    });
  });

  test("getAccountStatus probes seeded Codex auth.json under account home", async () => {
    const { service } = createService();
    const created = await service.createAccount({
      base: "codex",
      label: "Work",
    });
    if ("error" in created) {
      throw new Error(created.error.message);
    }

    const unauthenticated = await service.getAccountStatus(created.account.providerId);
    expect(unauthenticated.authStatus).toBe("unauthenticated");

    const idTokenPayload = Buffer.from(
      JSON.stringify({ email: "codex-work@example.com" }),
    ).toString("base64url");
    writeFileSync(
      path.join(created.account.homePath, "auth.json"),
      JSON.stringify({
        tokens: {
          access_token: "tok_test",
          id_token: `hdr.${idTokenPayload}.sig`,
        },
      }),
      "utf8",
    );

    const authenticated = await service.getAccountStatus(created.account.providerId);
    expect(authenticated.authStatus).toBe("authenticated");
    expect(authenticated.email).toBe("codex-work@example.com");
    expect(authenticated.homePath).toBe(created.account.homePath);
    expect(authenticated.error).toBeNull();
  });
});
