import { expect, test } from "@playwright/test";

test("Action Transport Lab A0.2 exposes separate body and isotropic-background maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");
  await expect(page.getByRole("heading", { name: /Action Transport Lab/ })).toBeVisible();
  await expect(page.getByText("A0.1 · BODY → PROBE")).toBeVisible();
  await expect(page.getByText("A0.2 · SKY → BODY SILHOUETTE → PROBE")).toBeVisible();
  await expect(page.getByTestId("action-field-map")).toBeVisible();
  await expect(page.getByTestId("background-angular-map")).toBeVisible();
  await expect(page.getByTestId("background-profile-chart")).toBeVisible();
  await expect(page.getByTestId("background-method-table").locator("tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("body-method-table").locator("tbody tr")).toHaveCount(4);
  await expect(page.getByTestId("background-ledger")).toContainText("Incident 4πI");
  await expect(page.getByTestId("action-audit-status")).toContainText("PASS");
  await expect(page.getByTestId("action-audit-metrics")).toContainText("Renderer first-hit max");
  expect(errors).toEqual([]);
});

test("A0.2 probe, channel, renderer and receipt controls remain interactive", async ({ page }) => {
  await page.goto("./action-lab/");
  const before = await page.locator("#probe-position").textContent();
  const map = page.getByTestId("action-field-map");
  const box = await map.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.click(box.x + box.width * 0.73, box.y + box.height * 0.35);
  await expect.poll(() => page.locator("#probe-position").textContent()).not.toBe(before);

  await page.locator("#display-channel").selectOption("BG_RESULTANT");
  await expect(page.locator("#map-title")).toContainText("residual");
  await page.locator("#display-channel").selectOption("BODY_W1");
  await expect(page.locator("#map-title")).toContainText("body-delivered");

  await page.locator("#renderer-samples").selectOption("2048");
  await expect(page.getByTestId("background-method-table")).toContainText("2,048 broad-cone rays");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export-receipt").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_ACTION_TRANSPORT_A0_2_RECEIPT.json");
});

test("A0.3 shows exact one-body W0/W1 closure and no invented finite equilibrium", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");
  await expect(page.getByTestId("closure-a03-panel")).toBeVisible();
  await expect(page.getByTestId("closure-scalar-chart")).toBeVisible();
  await expect(page.getByTestId("closure-vector-chart")).toBeVisible();
  await expect(page.getByTestId("closure-readout")).toContainText("нет: равны при всех r ≥ R");
  await expect(page.getByTestId("closure-conclusion")).toContainText("не отдельная граница упора");

  await page.locator("#closure-ratio").evaluate((element: HTMLInputElement) => {
    element.value = "0.7";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#closure-ratio-value")).toHaveText("0.70");
  await expect(page.getByTestId("closure-readout")).toContainText("знак один при всех r ≥ R");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#closure-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_ACTION_TRANSPORT_A0_3_ONE_BODY_CLOSURE_RECEIPT.json");
  expect(errors).toEqual([]);
});
