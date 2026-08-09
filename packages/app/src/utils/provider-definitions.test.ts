import { describe, expect, it } from "vitest";
import { orderProviderDefinitions } from "./provider-definitions";

describe("orderProviderDefinitions", () => {
  const defs = [{ id: "claude" }, { id: "codex" }, { id: "pi" }];

  it("keeps snapshot order when no config order is set", () => {
    expect(orderProviderDefinitions(defs, {}).map((d) => d.id)).toEqual(["claude", "codex", "pi"]);
  });

  it("sorts by persisted config order", () => {
    expect(
      orderProviderDefinitions(defs, {
        claude: { order: 2 },
        codex: { order: 0 },
        pi: { order: 1 },
      }).map((d) => d.id),
    ).toEqual(["codex", "pi", "claude"]);
  });

  it("prefers optimistic ids over config and snapshot order", () => {
    expect(
      orderProviderDefinitions(
        defs,
        {
          claude: { order: 0 },
          codex: { order: 1 },
          pi: { order: 2 },
        },
        ["pi", "claude", "codex"],
      ).map((d) => d.id),
    ).toEqual(["pi", "claude", "codex"]);
  });
});
