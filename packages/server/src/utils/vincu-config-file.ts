import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  VincuConfigRawSchema,
  type VincuConfigRaw,
  type VincuConfigRevision,
  type ProjectConfigRpcError,
} from "@getvincu/protocol/vincu-config-schema";
export {
  VincuConfigRevisionSchema,
  ProjectConfigRpcErrorSchema,
  type VincuConfigRevision,
  type ProjectConfigRpcError,
} from "@getvincu/protocol/vincu-config-schema";

export const VINCU_CONFIG_FILE_NAME = "vincu.json";

export type ReadVincuConfigForEditResult =
  | { ok: true; config: VincuConfigRaw | null; revision: VincuConfigRevision | null }
  | { ok: false; error: ProjectConfigRpcError };

export type WriteVincuConfigForEditResult =
  | { ok: true; config: VincuConfigRaw; revision: VincuConfigRevision }
  | { ok: false; error: ProjectConfigRpcError };

export interface WriteVincuConfigForEditInput {
  repoRoot: string;
  config: VincuConfigRaw;
  expectedRevision: VincuConfigRevision | null;
}

export function resolveVincuConfigPath(repoRoot: string): string {
  return join(repoRoot, VINCU_CONFIG_FILE_NAME);
}

export function statVincuConfigPath(repoRoot: string): VincuConfigRevision | null {
  const configPath = resolveVincuConfigPath(repoRoot);
  if (!existsSync(configPath)) {
    return null;
  }
  const stats = statSync(configPath);
  return {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
  };
}

export function readVincuConfigJson(repoRoot: string): unknown {
  const configPath = resolveVincuConfigPath(repoRoot);
  if (!existsSync(configPath)) {
    return null;
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function readVincuConfigForEdit(repoRoot: string): ReadVincuConfigForEditResult {
  try {
    const json = readVincuConfigJson(repoRoot);
    if (json === null) {
      return { ok: true, config: null, revision: null };
    }
    return {
      ok: true,
      config: VincuConfigRawSchema.parse(json),
      revision: statVincuConfigPath(repoRoot),
    };
  } catch {
    return {
      ok: false,
      error: { code: "invalid_project_config" },
    };
  }
}

export function writeVincuConfigForEdit(
  input: WriteVincuConfigForEditInput,
): WriteVincuConfigForEditResult {
  const parsed = VincuConfigRawSchema.safeParse(input.config);
  if (!parsed.success) {
    return { ok: false, error: { code: "invalid_project_config" } };
  }

  const configPath = resolveVincuConfigPath(input.repoRoot);
  const tempPath = join(
    input.repoRoot,
    `.${VINCU_CONFIG_FILE_NAME}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    writeFileSync(tempPath, `${JSON.stringify(parsed.data, null, 2)}\n`);
    const currentRevision = statVincuConfigPath(input.repoRoot);
    if (!vincuConfigRevisionsEqual(currentRevision, input.expectedRevision)) {
      removeTempVincuConfig(tempPath);
      return {
        ok: false,
        error: { code: "stale_project_config", currentRevision },
      };
    }

    renameSync(tempPath, configPath);
    const revision = statVincuConfigPath(input.repoRoot);
    if (!revision) {
      return { ok: false, error: { code: "write_failed" } };
    }
    return { ok: true, config: parsed.data, revision };
  } catch {
    removeTempVincuConfig(tempPath);
    return { ok: false, error: { code: "write_failed" } };
  }
}

function vincuConfigRevisionsEqual(
  left: VincuConfigRevision | null,
  right: VincuConfigRevision | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return left.mtimeMs === right.mtimeMs && left.size === right.size;
}

function removeTempVincuConfig(tempPath: string): void {
  try {
    rmSync(tempPath, { force: true });
  } catch {
    // Best-effort cleanup only; callers need the original write outcome.
  }
}
