import type { AgentModelDefinition } from "@getvincu/protocol/agent-types";
import type { ProviderProfileModel } from "@getvincu/protocol/provider-config";
import { filterSelectableModels } from "@/provider-selection/model-catalog";

export function buildAdditionalModelsWithDefault(
  additionalModels: ProviderProfileModel[],
  selected: Pick<ProviderProfileModel, "id" | "label" | "description">,
): ProviderProfileModel[] {
  const nextModels: ProviderProfileModel[] = additionalModels.map((model) =>
    model.isDefault === true ? Object.assign({}, model, { isDefault: false }) : model,
  );
  const existingIndex = nextModels.findIndex((model) => model.id === selected.id);
  if (existingIndex === -1) {
    nextModels.push({
      id: selected.id,
      label: selected.label,
      ...(selected.description ? { description: selected.description } : {}),
      isDefault: true,
    });
    return nextModels;
  }
  const existing = nextModels[existingIndex];
  if (existing) {
    nextModels[existingIndex] = Object.assign({}, existing, { isDefault: true });
  }
  return nextModels;
}

export interface ProviderDiscoveredModelsCache {
  serverId: string;
  provider: string;
  models: AgentModelDefinition[];
}

export interface ResolveProviderDiscoveredModelsInput {
  serverId: string;
  provider: string;
  currentModels: AgentModelDefinition[] | undefined;
  providerSnapshotRefreshing: boolean;
  previousCache: ProviderDiscoveredModelsCache | null;
}

export interface ResolveProviderDiscoveredModelsResult {
  models: AgentModelDefinition[];
  cache: ProviderDiscoveredModelsCache | null;
}

export function resolveProviderDiscoveredModels({
  serverId,
  provider,
  currentModels,
  providerSnapshotRefreshing,
  previousCache,
}: ResolveProviderDiscoveredModelsInput): ResolveProviderDiscoveredModelsResult {
  const selectableModels = filterSelectableModels(currentModels ?? null) ?? [];
  if (selectableModels.length > 0) {
    const cache = { serverId, provider, models: selectableModels };
    return { models: selectableModels, cache };
  }

  if (
    providerSnapshotRefreshing &&
    previousCache?.serverId === serverId &&
    previousCache.provider === provider
  ) {
    return { models: previousCache.models, cache: previousCache };
  }

  return { models: [], cache: previousCache };
}
