import { expect, test } from "@playwright/test";

test("C0/C1 relaxation generates particle, density and W-map views", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");
  const panel = page.getByTestId("c01-relaxation-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("c01-scene")).toBeVisible();
  await expect(page.getByTestId("c01-map")).toBeVisible();
  await expect(page.getByTestId("c01-profile")).toBeVisible();
  await expect(page.getByTestId("c01-comparison")).toBeVisible();
  await expect(page.locator("#c01-status")).not.toContainText("COMPUTING", { timeout: 30_000 });
  await expect(page.locator("#c01-verdict")).not.toHaveText("NOT RUN");
  await expect(page.getByTestId("c01-metrics")).toContainText("background amount C1 − C0");
  await expect(page.getByTestId("c01-conclusion")).toContainText("физическое время");

  await page.locator("#c01-boundary").selectOption("SPHERICAL_REPULSIVE_WALL");
  await expect(page.locator("#c01-particle-summary")).toContainText("spherical wall");
  await page.locator("#c01-state").selectOption("C0");
  await expect(page.locator("#c01-scene-title")).toContainText("C0 relaxed background");
  await page.locator("#c01-channel").selectOption("BACKGROUND_DELTA_W1");
  await expect(page.locator("#c01-map-title")).toHaveText("BACKGROUND_DELTA_W1");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#c01-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_C0_C1_GENERATED_CAVITY_RELAXATION_RECEIPT.json");
  expect(errors).toEqual([]);
});
