import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("supervisor lifecycle intents", () => {
  test("uses explicit shutdown and restart IPC intents", () => {
    const source = readFileSync(new URL("./supervisor.ts", import.meta.url), "utf8");
    const legacyShutdownReason = ["cli", "shutdown"].join("_");

    expect(source).toContain('"vincu:shutdown"');
    expect(source).toContain('"vincu:restart"');
    expect(source).not.toContain(legacyShutdownReason);
  });
});
