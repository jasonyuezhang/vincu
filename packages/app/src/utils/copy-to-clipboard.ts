import * as Clipboard from "expo-clipboard";
import { getDesktopHost } from "@/desktop/host";

/**
 * Copy text to the system clipboard.
 * On Electron, prefer the main-process bridge — renderer clipboard APIs often
 * fail when focus is elsewhere (e.g. after opening an external login page).
 */
export async function copyToClipboard(text: string): Promise<void> {
  const desktopCopy = getDesktopHost()?.browser?.copyElement;
  if (typeof desktopCopy === "function") {
    try {
      if (await desktopCopy({ text })) {
        return;
      }
    } catch {
      // Fall through to renderer clipboard APIs.
    }
  }

  try {
    await Clipboard.setStringAsync(text);
    return;
  } catch {
    // Fall through.
  }

  const writeText = globalThis.navigator?.clipboard?.writeText;
  if (typeof writeText === "function") {
    await writeText.call(globalThis.navigator.clipboard, text);
    return;
  }

  throw new Error("Clipboard is unavailable");
}
