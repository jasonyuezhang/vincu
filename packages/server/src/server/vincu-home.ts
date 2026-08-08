import { existsSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensurePrivateDirectory } from "./private-files.js";

function expandHomeDir(input: string): string {
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  if (input === "~") {
    return os.homedir();
  }
  return input;
}

// COMPAT(paseo-home): one-time ~/.paseo → ~/.vincu rename for the default home.
// Added in rebrand; remove after 2027-02-07.
export function maybeMigrateLegacyPaseoHome(options: {
  targetHome: string;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
}): boolean {
  const env = options.env ?? process.env;
  if (env.VINCU_HOME !== undefined) {
    return false;
  }

  const legacyHome = path.join(options.homedir ?? os.homedir(), ".paseo");
  if (!existsSync(legacyHome) || existsSync(options.targetHome)) {
    return false;
  }

  renameSync(legacyHome, options.targetHome);
  return true;
}

export function resolveVincuHome(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.VINCU_HOME ?? "~/.vincu";
  const resolved = path.resolve(expandHomeDir(raw));
  maybeMigrateLegacyPaseoHome({ targetHome: resolved, env });
  ensurePrivateDirectory(resolved);
  return resolved;
}
