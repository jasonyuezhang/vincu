import { expect, test, type Page } from "../support/fixtures";
import { gotoAppShell, openSettings } from "../support/helpers/app";
import { connectDaemonClient } from "../support/helpers/daemon-client-loader";
import { getServerId } from "../support/helpers/server-id";
import { openSettingsHost, openSettingsHostSection } from "../support/helpers/settings";

interface ProviderReorderDaemonClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  patchDaemonConfig(config: {
    providers?: Record<string, { order?: number }>;
  }): Promise<{ config: { providers?: Record<string, { order?: number }> } }>;
  getDaemonConfig(): Promise<{ config: { providers?: Record<string, { order?: number }> } }>;
}

async function getProviderRowIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="provider-row-"]')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-testid")?.replace("provider-row-", "") ?? ""),
    );
}

async function openProvidersSettings(page: Page): Promise<void> {
  await gotoAppShell(page);
  await openSettings(page);
  await openSettingsHost(page, getServerId());
  await openSettingsHostSection(page, getServerId(), "providers");
  await expect(page.locator('[data-testid^="provider-row-"]').first()).toBeVisible();
}

async function dragRowBelow(page: Page, dragId: string, targetId: string): Promise<void> {
  const handle = page.getByTestId(`provider-drag-handle-${dragId}`);
  const targetRow = page.getByTestId(`provider-row-${targetId}`);
  const handleBox = await handle.boundingBox();
  const targetBox = await targetRow.boundingBox();
  if (!handleBox || !targetBox) throw new Error("drag handle or target row not visible");

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endY = targetBox.y + targetBox.height * 0.8;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // dnd-kit MouseSensor needs >6px of movement before activation; step through.
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX, startY + ((endY - startY) * i) / steps);
  }
  await page.mouse.up();
}

test.describe("provider reorder", () => {
  test("drag reorders providers and persists across reload", async ({ page }) => {
    test.setTimeout(120_000);
    const client = await connectDaemonClient<ProviderReorderDaemonClient>({
      clientIdPrefix: "provider-reorder-e2e",
    });

    let initialIds: string[] = [];
    try {
      await openProvidersSettings(page);

      initialIds = await getProviderRowIds(page);
      expect(initialIds.length).toBeGreaterThanOrEqual(2);
      const [first, second] = initialIds;

      await dragRowBelow(page, first, second);

      // The dropped order must stick immediately (no snap-back).
      await expect
        .poll(() => getProviderRowIds(page))
        .toEqual([second, first, ...initialIds.slice(2)]);

      // The order must be persisted in daemon config.
      await expect
        .poll(async () => {
          const { config } = await client.getDaemonConfig();
          return [config.providers?.[second]?.order, config.providers?.[first]?.order];
        })
        .toEqual([0, 1]);

      // The order must survive a full reload.
      await openProvidersSettings(page);
      await expect
        .poll(() => getProviderRowIds(page))
        .toEqual([second, first, ...initialIds.slice(2)]);
    } finally {
      // Restore the original order so later specs see the seeded arrangement.
      // Only ids with a config entry are patchable (mock providers are not).
      if (initialIds.length >= 2) {
        try {
          const { config } = await client.getDaemonConfig();
          const patchableIds = initialIds.filter((id) => config.providers?.[id] !== undefined);
          await client.patchDaemonConfig({
            providers: Object.fromEntries(patchableIds.map((id, order) => [id, { order }])),
          });
        } catch {
          // Best-effort restore only.
        }
      }
      await client.close().catch(() => undefined);
    }
  });
});
