import { expect, test } from "@playwright/test";

test("equilibrium regime map verifies P1 and preserves resolution/claim firewalls", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("action-lab/");
  const panel = page.locator("#webgpu-equilibrium-regime-map-v1");
  await expect(panel).toBeVisible();
  await expect(panel.locator("#eq-status")).toContainText("PACKET VERIFIED", { timeout: 30_000 });
  await expect(panel).toContainText("ACTION_READOUT_NOT_SOURCE_FORCE");
  await expect(panel).toContainText("source: N16 (16³)");
  await expect(panel.locator("#eq-receiver-badge")).toContainText(/receiver: (129×97|257×193)/);
  await expect(panel).toContainText("render: CSS pixels / DPR");
  await panel.locator("#eq-frame").fill("12");
  await expect(panel.locator("#eq-frame-label")).toContainText("frame 12");
  await expect(panel.locator("#eq-map")).toBeVisible();
  expect(errors).toEqual([]);
});
