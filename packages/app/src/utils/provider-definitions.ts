import type { ProviderSnapshotEntry } from "@getvincu/protocol/agent-types";
import {
  type AgentModeColorTier,
  type AgentModeIcon,
  type AgentProviderDefinition,
  type AgentProviderModeDefinition,
} from "@getvincu/protocol/provider-manifest";

function buildProviderModes(entry: ProviderSnapshotEntry): AgentProviderModeDefinition[] {
  const entryModes = entry.modes ?? [];

  return entryModes.map((mode) =>
    Object.assign({}, mode, {
      icon: (mode.icon ?? "ShieldCheck") as AgentModeIcon,
      colorTier: (mode.colorTier ?? "moderate") as AgentModeColorTier,
    }),
  );
}

export function buildProviderDefinitions(
  snapshotEntries: ProviderSnapshotEntry[] | undefined,
): AgentProviderDefinition[] {
  if (!snapshotEntries?.length) {
    return [];
  }

  return snapshotEntries.map((entry) => ({
    id: entry.provider,
    label: entry.label ?? entry.provider,
    description: entry.description ?? "",
    defaultModeId: entry.defaultModeId ?? null,
    modes: buildProviderModes(entry),
  }));
}

export function resolveProviderLabel(
  provider: string,
  snapshotEntries: ProviderSnapshotEntry[] | undefined,
): string {
  return snapshotEntries?.find((entry) => entry.provider === provider)?.label ?? provider;
}

export function resolveProviderAccountEmail(
  provider: string,
  snapshotEntries: ProviderSnapshotEntry[] | undefined,
): string | null {
  const email = snapshotEntries?.find((entry) => entry.provider === provider)?.accountEmail;
  return typeof email === "string" && email.trim().length > 0 ? email.trim() : null;
}

export function formatProviderAccountSubtitle(options: {
  provider: string;
  snapshotEntries: ProviderSnapshotEntry[] | undefined;
  suffix?: string;
}): string {
  const label = resolveProviderLabel(options.provider, options.snapshotEntries);
  const email = resolveProviderAccountEmail(options.provider, options.snapshotEntries);
  const base = email ? `${label} · ${email}` : label;
  return options.suffix ? `${base} ${options.suffix}` : base;
}

export function resolveProviderDefinition(
  provider: string,
  snapshotEntries: ProviderSnapshotEntry[] | undefined,
): AgentProviderDefinition | undefined {
  return buildProviderDefinitions(snapshotEntries).find((definition) => definition.id === provider);
}
