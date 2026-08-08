import { describe, expect, it } from "vitest";

import { getVincuToolLeafName, isVincuToolName } from "@getvincu/protocol/tool-name-normalization";

describe("isVincuToolName", () => {
  it("detects Claude Code format", () => {
    expect(isVincuToolName("mcp__vincu__create_agent")).toBe(true);
    expect(isVincuToolName("mcp__vincu__list_agents")).toBe(true);
  });

  it("detects vincu_voice variant", () => {
    expect(isVincuToolName("mcp__vincu_voice__create_agent")).toBe(true);
    expect(isVincuToolName("vincu_voice.create_agent")).toBe(true);
  });

  it("excludes speak tools", () => {
    expect(isVincuToolName("mcp__vincu_voice__speak")).toBe(false);
    expect(isVincuToolName("mcp__vincu__speak")).toBe(false);
    expect(isVincuToolName("vincu.speak")).toBe(false);
  });

  it("detects Codex dot format", () => {
    expect(isVincuToolName("vincu.create_agent")).toBe(true);
  });

  it("rejects non-vincu tools", () => {
    expect(isVincuToolName("Bash")).toBe(false);
    expect(isVincuToolName("Read")).toBe(false);
    expect(isVincuToolName("mcp__other_server__some_tool")).toBe(false);
  });
});

describe("getVincuToolLeafName", () => {
  it("extracts leaf from Claude Code format", () => {
    expect(getVincuToolLeafName("mcp__vincu__create_agent")).toBe("create_agent");
  });

  it("extracts leaf from Codex format", () => {
    expect(getVincuToolLeafName("vincu.create_agent")).toBe("create_agent");
    expect(getVincuToolLeafName("vincu.list_agents")).toBe("list_agents");
  });

  it("returns null for non-vincu tools", () => {
    expect(getVincuToolLeafName("Bash")).toBeNull();
  });
});
