import { describe, expect, it } from "vitest";
import { normalizePaseoOwnedWorktreeMessage } from "./normalize-paseo-owned-worktree.js";

describe("normalizePaseoOwnedWorktreeMessage", () => {
  it("renames isPaseoOwnedWorktree when isVincuOwnedWorktree is absent", () => {
    const input = {
      type: "session",
      message: {
        type: "workspace.create.response",
        payload: {
          workspace: {
            project: {
              checkout: {
                cwd: "/tmp/repo",
                isGit: true,
                currentBranch: "main",
                remoteUrl: null,
                worktreeRoot: "/tmp/repo",
                isPaseoOwnedWorktree: false,
                mainRepoRoot: null,
              },
            },
          },
        },
      },
    };

    expect(normalizePaseoOwnedWorktreeMessage(input)).toEqual({
      type: "session",
      message: {
        type: "workspace.create.response",
        payload: {
          workspace: {
            project: {
              checkout: {
                cwd: "/tmp/repo",
                isGit: true,
                currentBranch: "main",
                remoteUrl: null,
                worktreeRoot: "/tmp/repo",
                isVincuOwnedWorktree: false,
                mainRepoRoot: null,
              },
            },
          },
        },
      },
    });
  });

  it("keeps isVincuOwnedWorktree when both fields are present", () => {
    const input = {
      checkout: {
        isVincuOwnedWorktree: true,
        isPaseoOwnedWorktree: false,
      },
    };

    expect(normalizePaseoOwnedWorktreeMessage(input)).toEqual({
      checkout: {
        isVincuOwnedWorktree: true,
      },
    });
  });
});
