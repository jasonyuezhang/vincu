import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  autoUpdateInstalledSkills,
  getSkillsStatus,
  installSkills,
  LEGACY_SKILL_NAMES,
  type SkillSelection,
  type SkillTargets,
  uninstallSkills,
  updateSkills,
} from "./operations";

const ALL_SKILLS: SkillSelection = { mode: "all" };

function only(...skills: string[]): SkillSelection {
  return { mode: "custom", skills };
}

interface Sandbox {
  root: string;
  targets: SkillTargets;
}

async function makeSandbox(): Promise<Sandbox> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vincu-skills-"));
  const targets: SkillTargets = {
    sourceDir: path.join(root, "bundle"),
    agentsDir: path.join(root, "home", ".agents", "skills"),
    claudeDir: path.join(root, "home", ".claude", "skills"),
    codexDir: path.join(root, "home", ".codex", "skills"),
  };
  await fs.mkdir(targets.sourceDir, { recursive: true });
  return { root, targets };
}

async function writeFiles(rootDir: string, files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(rootDir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
}

async function writeBundleSkill(
  sourceDir: string,
  name: string,
  files: Record<string, string>,
): Promise<void> {
  await writeFiles(path.join(sourceDir, name), files);
}

async function writeOnDiskSkill(
  agentsDir: string,
  name: string,
  files: Record<string, string>,
): Promise<void> {
  await writeFiles(path.join(agentsDir, name), files);
}

async function writeOnDiskSkillToAllTargets(
  targets: SkillTargets,
  name: string,
  files: Record<string, string>,
): Promise<void> {
  await Promise.all([
    writeOnDiskSkill(targets.agentsDir, name, files),
    writeOnDiskSkill(targets.claudeDir, name, files),
    writeOnDiskSkill(targets.codexDir, name, files),
  ]);
}

async function writeCurrentBundle(sourceDir: string): Promise<void> {
  await writeBundleSkill(sourceDir, "vincu", { "SKILL.md": "vincu-v1" });
  await writeBundleSkill(sourceDir, "vincu-loop", { "SKILL.md": "loop-v1" });
}

async function pathExists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}

async function installedIn(targets: SkillTargets, name: string): Promise<boolean[]> {
  return Promise.all(
    [targets.agentsDir, targets.claudeDir, targets.codexDir].map((dir) =>
      pathExists(path.join(dir, name)),
    ),
  );
}

describe("getSkillsStatus", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await fs.rm(sandbox.root, { recursive: true, force: true });
  });

  it("returns not-installed with add ops for every bundled skill when nothing is on disk", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("not-installed");
    expect(status.ops).toEqual([
      { kind: "add", name: "vincu" },
      { kind: "add", name: "vincu-loop" },
    ]);
  });

  it("reports every bundled skill as available", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeBundleSkill(sandbox.targets.sourceDir, "vincu-advisor", {
      "SKILL.md": "advisor-v1",
    });

    const status = await getSkillsStatus(sandbox.targets, only("vincu"));

    expect(status.available).toEqual(["vincu", "vincu-advisor", "vincu-loop"]);
  });

  it("reports a skill present in only one target as installed", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", { "SKILL.md": "vincu-v1" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    // `add` means "missing from at least one target", so it cannot answer
    // "is there a directory here to delete". `installed` answers that.
    expect(status.installed).toEqual(["vincu"]);
    expect(status.ops).toEqual([
      { kind: "add", name: "vincu" },
      { kind: "add", name: "vincu-loop" },
    ]);
  });

  it("reports legacy skill directories left on disk as installed", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu-chat", { "SKILL.md": "chat-old" });

    expect((await getSkillsStatus(sandbox.targets, ALL_SKILLS)).installed).toEqual(["vincu-chat"]);
  });

  it("returns not-installed when only user-personal skill dirs exist (the live bug)", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    for (const name of ["unslop", "tdd", "devbox"]) {
      await writeOnDiskSkill(sandbox.targets.agentsDir, name, { "SKILL.md": `user-${name}` });
    }

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("not-installed");
    expect(status.ops).toEqual([
      { kind: "add", name: "vincu" },
      { kind: "add", name: "vincu-loop" },
    ]);
  });

  it("returns up-to-date when every bundled skill matches on disk", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu-loop", { "SKILL.md": "loop-v1" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-loop"],
      installed: ["vincu", "vincu-loop"],
    });
  });

  it("ignores user-added files inside current managed skill dirs in every target", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu-loop", { "SKILL.md": "loop-v1" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", {
      "SKILL.md": "vincu-v1",
      "my-context.md": "user context",
    });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", {
      "SKILL.md": "vincu-v1",
      "commands/local.md": "user command",
    });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu", {
      "SKILL.md": "vincu-v1",
      "hooks/guard.sh": "user guard",
    });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-loop"],
      installed: ["vincu", "vincu-loop"],
    });
  });

  it("returns drift with a single update op when one bundled file diverges", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", { "SKILL.md": "stale" });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu-loop", { "SKILL.md": "loop-v1" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("drift");
    expect(status.ops).toEqual([{ kind: "update", name: "vincu" }]);
  });

  it("returns drift when a secondary agent target is stale", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu-loop", { "SKILL.md": "loop-v1" });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", { "SKILL.md": "stale" });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu-loop", { "SKILL.md": "loop-v1" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu-loop", { "SKILL.md": "loop-v1" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("drift");
    expect(status.ops).toEqual([{ kind: "update", name: "vincu" }]);
  });

  it("returns drift with add ops for the bundled skills missing from disk", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu", { "SKILL.md": "vincu-v1" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("drift");
    expect(status.ops).toEqual([{ kind: "add", name: "vincu-loop" }]);
  });

  it("returns drift with a delete op for a legacy skill name still on disk", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu-loop", { "SKILL.md": "loop-v1" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu-chat", { "SKILL.md": "chat-old" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("drift");
    expect(status.ops).toEqual([{ kind: "delete", name: "vincu-chat" }]);
  });

  it("emits add + update + delete ops sorted by name when state is mixed", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", { "SKILL.md": "stale" });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu-chat", { "SKILL.md": "chat-old" });

    const status = await getSkillsStatus(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("drift");
    expect(status.ops).toEqual([
      { kind: "update", name: "vincu" },
      { kind: "delete", name: "vincu-chat" },
      { kind: "add", name: "vincu-loop" },
    ]);
  });
});

describe("custom skill selection", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeBundleSkill(sandbox.targets.sourceDir, "vincu-advisor", {
      "SKILL.md": "advisor-v1",
    });
  });

  afterEach(async () => {
    await fs.rm(sandbox.root, { recursive: true, force: true });
  });

  it("installs only the selected skills", async () => {
    const status = await installSkills(sandbox.targets, only("vincu", "vincu-loop"));

    expect(status).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-advisor", "vincu-loop"],
      installed: ["vincu", "vincu-loop"],
    });
    expect(await installedIn(sandbox.targets, "vincu")).toEqual([true, true, true]);
    expect(await installedIn(sandbox.targets, "vincu-loop")).toEqual([true, true, true]);
    expect(await installedIn(sandbox.targets, "vincu-advisor")).toEqual([false, false, false]);
  });

  it("reports up-to-date while an unselected bundled skill is absent", async () => {
    await installSkills(sandbox.targets, only("vincu"));

    const status = await getSkillsStatus(sandbox.targets, only("vincu"));

    expect(status).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-advisor", "vincu-loop"],
      installed: ["vincu"],
    });
  });

  it("removes a previously installed skill once it leaves the selection", async () => {
    await installSkills(sandbox.targets, ALL_SKILLS);

    const status = await installSkills(sandbox.targets, only("vincu"));

    expect(status.state).toBe("up-to-date");
    expect(await installedIn(sandbox.targets, "vincu")).toEqual([true, true, true]);
    expect(await installedIn(sandbox.targets, "vincu-loop")).toEqual([false, false, false]);
    expect(await installedIn(sandbox.targets, "vincu-advisor")).toEqual([false, false, false]);
  });

  it("reports a delete op for a deselected skill before it is applied", async () => {
    await installSkills(sandbox.targets, ALL_SKILLS);

    const status = await getSkillsStatus(sandbox.targets, only("vincu", "vincu-advisor"));

    expect(status.state).toBe("drift");
    expect(status.ops).toEqual([{ kind: "delete", name: "vincu-loop" }]);
  });

  it("leaves unrelated user skills untouched", async () => {
    await writeOnDiskSkill(sandbox.targets.agentsDir, "unslop", { "SKILL.md": "user-unslop" });

    await installSkills(sandbox.targets, only("vincu"));

    expect(
      await fs.readFile(path.join(sandbox.targets.agentsDir, "unslop", "SKILL.md"), "utf-8"),
    ).toBe("user-unslop");
  });

  it("treats an empty custom selection as no managed skills installed", async () => {
    await installSkills(sandbox.targets, ALL_SKILLS);

    const status = await installSkills(sandbox.targets, only());

    expect(status).toEqual({
      state: "not-installed",
      ops: [],
      available: ["vincu", "vincu-advisor", "vincu-loop"],
      installed: [],
    });
    expect(await installedIn(sandbox.targets, "vincu")).toEqual([false, false, false]);
    expect(await installedIn(sandbox.targets, "vincu-loop")).toEqual([false, false, false]);
  });

  it("ignores selected names that the bundle does not ship", async () => {
    const status = await installSkills(sandbox.targets, only("vincu", "not-a-skill"));

    expect(status).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-advisor", "vincu-loop"],
      installed: ["vincu"],
    });
    expect(await installedIn(sandbox.targets, "not-a-skill")).toEqual([false, false, false]);
  });

  it("still deletes legacy skill names that are not selectable", async () => {
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu-orchestrator", {
      "SKILL.md": "orchestrator-old",
    });

    await installSkills(sandbox.targets, only("vincu"));

    expect(await installedIn(sandbox.targets, "vincu-orchestrator")).toEqual([false, false, false]);
  });
});

describe("installSkills / updateSkills", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await fs.rm(sandbox.root, { recursive: true, force: true });
  });

  it("installs from a clean machine, populates all three targets, and leaves user dirs alone", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "unslop", { "SKILL.md": "user-unslop" });

    const status = await installSkills(sandbox.targets, ALL_SKILLS);

    expect(status).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-loop"],
      installed: ["vincu", "vincu-loop"],
    });
    for (const name of ["vincu", "vincu-loop"]) {
      expect(
        await fs.readFile(path.join(sandbox.targets.agentsDir, name, "SKILL.md"), "utf-8"),
      ).toBe(name === "vincu" ? "vincu-v1" : "loop-v1");
      expect(
        await fs.readFile(path.join(sandbox.targets.codexDir, name, "SKILL.md"), "utf-8"),
      ).toBe(name === "vincu" ? "vincu-v1" : "loop-v1");
      expect(await pathExists(path.join(sandbox.targets.claudeDir, name))).toBe(true);
    }
    expect(
      await fs.readFile(path.join(sandbox.targets.agentsDir, "unslop", "SKILL.md"), "utf-8"),
    ).toBe("user-unslop");
  });

  it("repairs missing and edited skills without deleting a legacy directory", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", { "SKILL.md": "stale" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu-chat", { "SKILL.md": "chat-old" });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu-chat", { "SKILL.md": "chat-old" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu-chat", { "SKILL.md": "chat-old" });

    const status = await updateSkills(sandbox.targets, ALL_SKILLS);

    expect(status).toEqual({
      state: "drift",
      ops: [{ kind: "delete", name: "vincu-chat" }],
      available: ["vincu", "vincu-loop"],
      installed: ["vincu", "vincu-chat", "vincu-loop"],
    });
    expect(
      await fs.readFile(path.join(sandbox.targets.agentsDir, "vincu", "SKILL.md"), "utf-8"),
    ).toBe("vincu-v1");
    expect(
      await fs.readFile(path.join(sandbox.targets.agentsDir, "vincu-loop", "SKILL.md"), "utf-8"),
    ).toBe("loop-v1");
    for (const dir of [
      sandbox.targets.agentsDir,
      sandbox.targets.claudeDir,
      sandbox.targets.codexDir,
    ]) {
      expect(await pathExists(path.join(dir, "vincu-chat"))).toBe(true);
    }
  });

  it("defines updated as the state reached after preserving user files", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkillToAllTargets(sandbox.targets, "vincu-loop", { "SKILL.md": "loop-v1" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", {
      "SKILL.md": "stale",
      "hooks/guard.sh": "user guard",
    });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", {
      "SKILL.md": "vincu-v1",
      "notes/local.md": "claude notes",
    });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu", {
      "SKILL.md": "vincu-v1",
      "prompts/local.md": "codex prompt",
    });

    const status = await updateSkills(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("up-to-date");
    expect(await getSkillsStatus(sandbox.targets, ALL_SKILLS)).toEqual({
      state: "up-to-date",
      ops: [],
      available: ["vincu", "vincu-loop"],
      installed: ["vincu", "vincu-loop"],
    });
    expect(
      await fs.readFile(
        path.join(sandbox.targets.agentsDir, "vincu", "hooks", "guard.sh"),
        "utf-8",
      ),
    ).toBe("user guard");
    expect(
      await fs.readFile(
        path.join(sandbox.targets.claudeDir, "vincu", "notes", "local.md"),
        "utf-8",
      ),
    ).toBe("claude notes");
    expect(
      await fs.readFile(
        path.join(sandbox.targets.codexDir, "vincu", "prompts", "local.md"),
        "utf-8",
      ),
    ).toBe("codex prompt");
  });

  it("repairs secondary agent targets even when agents skills are current", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu-loop", { "SKILL.md": "loop-v1" });
    await writeOnDiskSkill(sandbox.targets.claudeDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu", { "SKILL.md": "vincu-v1" });
    await writeOnDiskSkill(sandbox.targets.codexDir, "vincu-loop", { "SKILL.md": "loop-v1" });

    const status = await updateSkills(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("up-to-date");
    expect(
      await fs.readFile(path.join(sandbox.targets.claudeDir, "vincu-loop", "SKILL.md"), "utf-8"),
    ).toBe("loop-v1");
  });

  it("auto-updates drifted installed skills", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await writeOnDiskSkill(sandbox.targets.agentsDir, "vincu", {
      "SKILL.md": "stale",
      "hooks/guard.sh": "user guard",
    });

    const status = await autoUpdateInstalledSkills(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("up-to-date");
    expect((await getSkillsStatus(sandbox.targets, ALL_SKILLS)).state).toBe("up-to-date");
    expect(
      await fs.readFile(path.join(sandbox.targets.agentsDir, "vincu", "SKILL.md"), "utf-8"),
    ).toBe("vincu-v1");
    expect(
      await fs.readFile(
        path.join(sandbox.targets.agentsDir, "vincu", "hooks", "guard.sh"),
        "utf-8",
      ),
    ).toBe("user guard");
  });

  it("does not auto-install skills on a clean machine", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);

    const status = await autoUpdateInstalledSkills(sandbox.targets, ALL_SKILLS);

    expect(status).toEqual({
      state: "not-installed",
      ops: [
        { kind: "add", name: "vincu" },
        { kind: "add", name: "vincu-loop" },
      ],
      available: ["vincu", "vincu-loop"],
      installed: [],
    });
    expect(await installedIn(sandbox.targets, "vincu")).toEqual([false, false, false]);
  });

  it("is idempotent — running install twice keeps state at up-to-date", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);

    const first = await installSkills(sandbox.targets, ALL_SKILLS);
    const second = await installSkills(sandbox.targets, ALL_SKILLS);

    expect(first.state).toBe("up-to-date");
    expect(second.state).toBe("up-to-date");
  });
});

describe("uninstallSkills", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await makeSandbox();
  });

  afterEach(async () => {
    await fs.rm(sandbox.root, { recursive: true, force: true });
  });

  it("removes every Vincu skill from all three targets and preserves user dirs", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    await installSkills(sandbox.targets, ALL_SKILLS);
    for (const name of ["unslop", "tdd", "devbox"]) {
      await writeOnDiskSkill(sandbox.targets.agentsDir, name, { "SKILL.md": `user-${name}` });
    }

    const status = await uninstallSkills(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("not-installed");
    for (const name of ["vincu", "vincu-loop", ...LEGACY_SKILL_NAMES]) {
      expect(await installedIn(sandbox.targets, name)).toEqual([false, false, false]);
    }
    for (const name of ["unslop", "tdd", "devbox"]) {
      expect(
        await fs.readFile(path.join(sandbox.targets.agentsDir, name, "SKILL.md"), "utf-8"),
      ).toBe(`user-${name}`);
    }
  });

  it("is a no-op when nothing is installed", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);

    const status = await uninstallSkills(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("not-installed");
  });

  it("cleans up legacy skill names that linger in agents, claude, and codex", async () => {
    await writeCurrentBundle(sandbox.targets.sourceDir);
    for (const dir of [
      sandbox.targets.agentsDir,
      sandbox.targets.claudeDir,
      sandbox.targets.codexDir,
    ]) {
      await writeOnDiskSkill(dir, "vincu-chat", { "SKILL.md": "chat-old" });
    }

    const status = await uninstallSkills(sandbox.targets, ALL_SKILLS);

    expect(status.state).toBe("not-installed");
    expect(await installedIn(sandbox.targets, "vincu-chat")).toEqual([false, false, false]);
  });
});
