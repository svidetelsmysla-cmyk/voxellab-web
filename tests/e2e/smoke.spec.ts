import { expect, test } from "@playwright/test";

test("public MVP loads, steps, resets, exchanges JSON and inspects packet", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /VoxelLab/ })).toBeVisible();
  await expect(page.getByTestId("viewport")).toBeVisible();
  await expect(page.getByTestId("scene-tree").locator(".tree-row")).toHaveCount(2);
  await expect(page.getByTestId("backend-status")).toContainText(/WebGPU|CPU Worker/);

  const viewport = page.getByTestId("viewport");
  await page.getByTestId("scene-tree").locator(".tree-row").nth(1).click();
  const before = await viewport.getAttribute("data-selected-position");
  await page.getByTestId("step").click();
  await expect.poll(() => viewport.getAttribute("data-selected-position")).not.toBe(before);
  await page.getByTestId("reset").click();
  await expect.poll(() => viewport.getAttribute("data-selected-position")).toBe(before);

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-scene").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("SCENE_03_MOVABLE_RIGID_VOLUME.json");
  const exportedPath = await download.path();
  expect(exportedPath).not.toBeNull();
  await page.getByTestId("scene-file").setInputFiles(exportedPath!);
  await expect(page.locator("#file-status")).toContainText("Loaded scene SCENE_03_MOVABLE_RIGID_VOLUME");

  await page.getByTestId("scene-tree").locator(".tree-row").nth(1).click();
  await page.getByTestId("run").click();
  await expect(page.locator("#motion-status")).toHaveText("RUNNING");
  await page.getByTestId("stop").click();
  await expect(page.locator("#motion-status")).toHaveText("PAUSED");

  await page.locator("#load-demo-packet").click();
  await expect(page.getByTestId("packet-card")).toContainText("RIGID_VOLUME_AND_SOLID_ANGLE_SH_PARITY_BLOCKER");
  await expect(page.getByTestId("packet-card")).toContainText("RUNTIME_DIAGNOSTIC_NOT_VALIDATION");
  await expect(page.locator("#error-banner")).toBeHidden();

  await page.getByTestId("representation-select").selectOption("CM_CONTROL");
  await expect(page.getByTestId("representation-select")).toHaveValue("CM_CONTROL");
  expect(consoleErrors).toEqual([]);
});

test("desktop screenshot receipt", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("./");
  await page.locator("#load-demo-packet").click();
  await expect(page.getByTestId("packet-card")).toContainText("RIGID_VOLUME_AND_SOLID_ANGLE_SH_PARITY_BLOCKER");
  await expect(page.locator("#error-banner")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("VOXELLAB_WEB_PUBLIC_DEPLOYMENT_DESKTOP.png"), fullPage: true });
});
