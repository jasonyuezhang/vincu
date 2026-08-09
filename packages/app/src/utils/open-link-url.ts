import { isElectronRuntime } from "@/desktop/host";
import { loadAppSettingsFromStorage } from "@/hooks/use-settings";
import { openExternalUrl } from "@/utils/open-external-url";

const IN_APP_LINK_PROTOCOLS = new Set(["http:", "https:"]);

type InAppLinkOpener = (url: string) => void;

let inAppLinkOpener: InAppLinkOpener | null = null;

/**
 * Register the workspace's "open URL in a browser tab" callback so content
 * links anywhere in the app can reach the internal browser pane. Last
 * registration wins; the returned cleanup only unregisters itself.
 */
export function registerInAppLinkOpener(opener: InAppLinkOpener): () => void {
  inAppLinkOpener = opener;
  return () => {
    if (inAppLinkOpener === opener) {
      inAppLinkOpener = null;
    }
  };
}

function canOpenInApp(url: string): boolean {
  try {
    return IN_APP_LINK_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Open a content link (chat/markdown/file links) honoring the "Open links"
 * setting: in the internal browser pane on desktop when set to "in-app",
 * otherwise in the external browser. System links (OAuth, updates, help)
 * should keep calling `openExternalUrl` directly.
 */
export async function openLinkUrl(url: string): Promise<void> {
  if (!isElectronRuntime() || !inAppLinkOpener || !canOpenInApp(url)) {
    await openExternalUrl(url);
    return;
  }

  const settings = await loadAppSettingsFromStorage();
  if (settings.linkOpenBehavior !== "in-app") {
    await openExternalUrl(url);
    return;
  }

  inAppLinkOpener(url);
}
