import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { maybeMigrateLegacyPaseoHome, resolveVincuHome } from "./vincu-home.js";
import { PRIVATE_DIRECTORY_MODE } from "./private-files.js";

const MODE_MASK = 0o777;

function modeOf(filePath: string): number {
  return statSync(filePath).mode & MODE_MASK;
}

describe.skipIf(process.platform === "win32")("resolveVincuHome permissions", () => {
  test("creates VINCU_HOME with private permissions", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "vincu-home-parent-"));
    const vincuHome = path.join(parent, "home");
    try {
      expect(resolveVincuHome({ VINCU_HOME: vincuHome })).toBe(vincuHome);
      expect(modeOf(vincuHome)).toBe(PRIVATE_DIRECTORY_MODE);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("maybeMigrateLegacyPaseoHome", () => {
  test("renames ~/.paseo to the default ~/.vincu when the target is missing", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "vincu-home-migrate-"));
    const legacyHome = path.join(parent, ".paseo");
    const targetHome = path.join(parent, ".vincu");
    mkdirSync(legacyHome);
    writeFileSync(path.join(legacyHome, "config.json"), "{}");

    try {
      expect(
        maybeMigrateLegacyPaseoHome({
          targetHome,
          env: {},
          homedir: parent,
        }),
      ).toBe(true);
      expect(statSync(path.join(targetHome, "config.json")).isFile()).toBe(true);
      expect(() => statSync(legacyHome)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test("does not migrate when VINCU_HOME is set", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "vincu-home-migrate-explicit-"));
    const legacyHome = path.join(parent, ".paseo");
    const targetHome = path.join(parent, ".vincu");
    mkdirSync(legacyHome);

    try {
      expect(
        maybeMigrateLegacyPaseoHome({
          targetHome,
          env: { VINCU_HOME: targetHome },
          homedir: parent,
        }),
      ).toBe(false);
      expect(statSync(legacyHome).isDirectory()).toBe(true);
      expect(() => statSync(targetHome)).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test("does not overwrite an existing ~/.vincu", () => {
    const parent = mkdtempSync(path.join(tmpdir(), "vincu-home-migrate-keep-"));
    const legacyHome = path.join(parent, ".paseo");
    const targetHome = path.join(parent, ".vincu");
    mkdirSync(legacyHome);
    mkdirSync(targetHome);
    writeFileSync(path.join(legacyHome, "legacy.json"), "{}");
    writeFileSync(path.join(targetHome, "config.json"), "{}");

    try {
      expect(
        maybeMigrateLegacyPaseoHome({
          targetHome,
          env: {},
          homedir: parent,
        }),
      ).toBe(false);
      expect(statSync(path.join(legacyHome, "legacy.json")).isFile()).toBe(true);
      expect(statSync(path.join(targetHome, "config.json")).isFile()).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
