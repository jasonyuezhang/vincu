import { beforeEach, describe, expect, it, vi } from "vitest";

const setStringAsync = vi.fn(async (_text: string) => true);
const copyElement = vi.fn(async () => true);
const getDesktopHost = vi.fn(
  () => null as null | { browser?: { copyElement?: typeof copyElement } },
);

vi.mock("expo-clipboard", () => ({
  setStringAsync: (text: string) => setStringAsync(text),
}));

vi.mock("@/desktop/host", () => ({
  getDesktopHost: () => getDesktopHost(),
}));

describe("copyToClipboard", () => {
  beforeEach(() => {
    setStringAsync.mockReset();
    setStringAsync.mockResolvedValue(true);
    copyElement.mockReset();
    copyElement.mockResolvedValue(true);
    getDesktopHost.mockReset();
    getDesktopHost.mockReturnValue(null);
  });

  it("uses the Electron main-process clipboard bridge when available", async () => {
    getDesktopHost.mockReturnValue({ browser: { copyElement } });
    const { copyToClipboard } = await import("./copy-to-clipboard");

    await copyToClipboard("ABCD-EFGHI");

    expect(copyElement).toHaveBeenCalledWith({ text: "ABCD-EFGHI" });
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  it("falls back to expo-clipboard when the desktop bridge is unavailable", async () => {
    const { copyToClipboard } = await import("./copy-to-clipboard");

    await copyToClipboard("ABCD-EFGHI");

    expect(setStringAsync).toHaveBeenCalledWith("ABCD-EFGHI");
  });
});
