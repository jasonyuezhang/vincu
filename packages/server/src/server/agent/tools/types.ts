import type { z } from "zod";

export interface VincuToolExecutionContext {
  signal?: AbortSignal;
  sendUpdate?: (update: VincuToolResult) => void;
}

export interface VincuToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface VincuToolConfig {
  title?: string;
  description?: string;
  inputSchema?: z.ZodRawShape | z.ZodType;
  outputSchema?: z.ZodRawShape;
}

export interface VincuToolDefinition extends VincuToolConfig {
  name: string;
  description: string;
  handler: (input: unknown, context: VincuToolExecutionContext) => Promise<VincuToolResult>;
}

export interface VincuToolCatalog {
  tools: ReadonlyMap<string, VincuToolDefinition>;
  getTool(name: string): VincuToolDefinition | undefined;
  executeTool(
    name: string,
    input: unknown,
    context?: VincuToolExecutionContext,
  ): Promise<VincuToolResult>;
}

export interface VincuToolRuntimeContext {
  callerAgentId?: string;
  enableVoiceTools?: boolean;
  voiceOnly?: boolean;
}

export type VincuToolCatalogFactory = (
  context: VincuToolRuntimeContext,
) => VincuToolCatalog | Promise<VincuToolCatalog>;
