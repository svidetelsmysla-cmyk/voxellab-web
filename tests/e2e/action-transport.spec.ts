import { expect, test } from "@playwright/test";

test("Action Transport Lab A0 loads as a separate governed research site", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");
  await expect(page.getByRole("heading", { name: /Action Transport Lab/ })).toBeVisible();
  await expect(page.getByTestId("action-field-map")).toBeVisible();
  await expect(page.getByTestId("angular-thickness-map")).toBeVisible();
  await expect(page.getByTestId("action-profile-chart")).toBeVisible();
  await expect(page.getByTestId("probe-method-table").locator("tbody tr")).toHaveCount(4);
  await expect(page.getByTestId("action-audit-status")).toContainText("PASS");
  await expect(page.getByTestId("action-audit-metrics")).toContainText("Volume cubature max");
  await expect(page.locator("#quantity-passport-text")).toContainText("not field amount or force");
  expect(errors).toEqual([]);
});

test("Action Transport Lab probe, channel and receipt controls remain interactive", async ({ page }) => {
  await page.goto("./action-lab/");
  const before = await page.locator("#probe-position").textContent();
  const map = page.getByTestId("action-field-map");
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.36);
  await expect.poll(() => page.locator("#probe-position").textContent()).not.toBe(before);
  await page.locator("#display-channel").selectOption("W1");
  await expect(page.locator("#map-title")).toContainText("W1");
  await page.locator("#renderer-samples").selectOption("512");
  await expect(page.getByTestId("probe-method-table")).toContainText("512 deterministic cap samples");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-receipt").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_ACTION_TRANSPORT_A0_PROBE_RECEIPT.json");
});
