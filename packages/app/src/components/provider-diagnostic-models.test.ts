import { describe, expect, it } from "vitest";
import type { AgentModelDefinition } from "@getvincu/protocol/agent-types";
import type { ProviderProfileModel } from "@getvincu/protocol/provider-config";
import {
  buildAdditionalModelsWithDefault,
  resolveProviderDiscoveredModels,
  type ProviderDiscoveredModelsCache,
} from "./provider-diagnostic-models";

describe("buildAdditionalModelsWithDefault", () => {
  it("adds a discovered model override marked as the sole default", () => {
    const existing: ProviderProfileModel[] = [
      { id: "custom-a", label: "Custom A", isDefault: true },
    ];

    expect(
      buildAdditionalModelsWithDefault(existing, {
        id: "gpt-5.4",
        label: "GPT-5.4",
        description: "Solid coding model.",
      }),
    ).toEqual([
      { id: "custom-a", label: "Custom A", isDefault: false },
      {
        id: "gpt-5.4",
        label: "GPT-5.4",
        description: "Solid coding model.",
        isDefault: true,
      },
    ]);
  });

  it("flips isDefault onto an existing additional model and clears siblings", () => {
    const existing: ProviderProfileModel[] = [
      { id: "custom-a", label: "Custom A", isDefault: true },
      { id: "custom-b", label: "Custom B" },
    ];

    expect(
      buildAdditionalModelsWithDefault(existing, { id: "custom-b", label: "Custom B" }),
    ).toEqual([
      { id: "custom-a", label: "Custom A", isDefault: false },
      { id: "custom-b", label: "Custom B", isDefault: true },
    ]);
  });
});

const piModel: AgentModelDefinition = {
  provider: "pi",
  id: "pi/model",
  label: "Pi Model",
};

const grokModel: AgentModelDefinition = {
  provider: "grok",
  id: "grok-build",
  label: "Grok Build",
};

function resolveModels(input: {
  serverId?: string;
  provider: string;
  currentModels?: AgentModelDefinition[];
  loading?: boolean;
  cache?: ProviderDiscoveredModelsCache | null;
}) {
  return resolveProviderDiscoveredModels({
    serverId: input.serverId ?? "local",
    provider: input.provider,
    currentModels: input.currentModels,
    providerSnapshotRefreshing: input.loading === true,
    previousCache: input.cache ?? null,
  });
}

describe("resolveProviderDiscoveredModels", () => {
  it("keeps a provider's cached discovered models visible while that provider refreshes", () => {
    const ready = resolveModels({ provider: "grok", currentModels: [grokModel] });

    const refreshing = resolveModels({ provider: "grok", loading: true, cache: ready.cache });

    expect(refreshing.models).toEqual([grokModel]);
  });

  it("excludes compatibility-only models from display and cache", () => {
    const compatibilityModel: AgentModelDefinition = {
      ...piModel,
      id: "pi/model-legacy",
      label: "Pi Model legacy",
      isSelectable: false,
    };

    const result = resolveModels({
      provider: "pi",
      currentModels: [piModel, compatibilityModel],
    });

    expect(result.models).toEqual([piModel]);
    expect(result.cache?.models).toEqual([piModel]);
  });

  it("does not show one provider's cached models while another provider loads", () => {
    const ready = resolveModels({ provider: "pi", currentModels: [piModel] });

    const refreshing = resolveModels({ provider: "grok", loading: true, cache: ready.cache });

    expect(refreshing.models).toEqual([]);
  });

  it("does not show another server's cached models while the same provider loads", () => {
    const ready = resolveModels({
      serverId: "server-a",
      provider: "grok",
      currentModels: [grokModel],
    });

    const refreshing = resolveModels({
      serverId: "server-b",
      provider: "grok",
      loading: true,
      cache: ready.cache,
    });

    expect(refreshing.models).toEqual([]);
  });
});
