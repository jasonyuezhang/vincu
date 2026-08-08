import { z } from "zod";

const TCP_PORT_RANGE_PATTERN = /^(\d{1,5})-(\d{1,5})$/;

export const VincuServicePortAllocationSchema = z
  .object({
    range: z.string().trim().regex(TCP_PORT_RANGE_PATTERN).optional(),
    portScript: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (value) => value.range !== undefined || value.portScript !== undefined,
    "Expected range or portScript",
  )
  .refine((value) => {
    if (!value.range) return true;
    const match = TCP_PORT_RANGE_PATTERN.exec(value.range);
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2]);
    return start >= 1 && end <= 65_535 && start <= end;
  }, "Expected an inclusive TCP port range from 1-65535");

export function normalizeLifecycleCommands(commands: unknown): string[] {
  if (typeof commands === "string") {
    return commands.trim().length > 0 ? [commands] : [];
  }
  if (!Array.isArray(commands)) {
    return [];
  }
  return commands.filter((command): command is string => {
    return typeof command === "string" && command.trim().length > 0;
  });
}

export const VincuLifecycleCommandRawSchema = z.union([z.string(), z.array(z.string())]);

export const VincuScriptEntryRawSchema = z
  .object({
    type: z.unknown().optional(),
    command: z.unknown().optional(),
    port: z.unknown().optional(),
  })
  .passthrough();

export const VincuWorktreeConfigRawSchema = z
  .object({
    setup: VincuLifecycleCommandRawSchema.optional(),
    teardown: VincuLifecycleCommandRawSchema.optional(),
    terminals: z.unknown().optional(),
    servicePorts: VincuServicePortAllocationSchema.optional(),
  })
  .passthrough();

export const VincuMetadataGenerationEntrySchema = z
  .object({
    instructions: z.string().optional(),
  })
  .passthrough()
  .catch({});

export const VincuMetadataGenerationSchema = z
  .object({
    title: VincuMetadataGenerationEntrySchema.optional(),
    branchName: VincuMetadataGenerationEntrySchema.optional(),
    commitMessage: VincuMetadataGenerationEntrySchema.optional(),
    pullRequest: VincuMetadataGenerationEntrySchema.optional(),
  })
  // COMPAT(projectMetadataAgentTitle): `agentTitle` project metadata prompts were removed
  // in v0.1.96; keep legacy vincu.json parseable until 2026-12-16.
  .passthrough()
  .catch({});

export const VincuConfigRawSchema = z
  .object({
    worktree: VincuWorktreeConfigRawSchema.optional(),
    scripts: z.record(z.string(), VincuScriptEntryRawSchema).optional(),
    metadataGeneration: VincuMetadataGenerationSchema.optional(),
  })
  .passthrough();

export const WorktreeConfigSchema = VincuWorktreeConfigRawSchema.extend({
  setup: z.unknown().optional().transform(normalizeLifecycleCommands),
  teardown: z.unknown().optional().transform(normalizeLifecycleCommands),
})
  .passthrough()
  .catch({ setup: [], teardown: [] });

export const ScriptEntrySchema = VincuScriptEntryRawSchema.catch({});

export const VincuConfigSchema = VincuConfigRawSchema.extend({
  worktree: WorktreeConfigSchema.optional(),
  scripts: z.record(z.string(), ScriptEntrySchema).optional().catch({}),
  metadataGeneration: VincuMetadataGenerationSchema.optional(),
})
  .passthrough()
  .catch({});

export const VincuConfigRevisionSchema = z.object({
  mtimeMs: z.number(),
  size: z.number(),
});

export const ProjectConfigRpcErrorSchema = z.discriminatedUnion("code", [
  z.object({ code: z.literal("project_not_found") }),
  z.object({ code: z.literal("invalid_project_config") }),
  z.object({
    code: z.literal("stale_project_config"),
    currentRevision: VincuConfigRevisionSchema.nullable(),
  }),
  z.object({ code: z.literal("write_failed") }),
]);

export type VincuScriptEntryRaw = z.infer<typeof VincuScriptEntryRawSchema>;
export type VincuMetadataGenerationEntry = z.infer<typeof VincuMetadataGenerationEntrySchema>;
export type VincuMetadataGeneration = z.infer<typeof VincuMetadataGenerationSchema>;
export type VincuServicePortAllocation = z.infer<typeof VincuServicePortAllocationSchema>;
export type VincuConfigRaw = z.infer<typeof VincuConfigRawSchema>;
export type VincuConfig = z.infer<typeof VincuConfigSchema>;
export type VincuConfigRevision = z.infer<typeof VincuConfigRevisionSchema>;
export type ProjectConfigRpcError = z.infer<typeof ProjectConfigRpcErrorSchema>;
