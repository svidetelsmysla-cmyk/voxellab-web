import { expect, test } from "@playwright/test";

test("C1 shows the central body, particle cavity and separate W channels", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");
  await expect(page.getByTestId("c1-cavity-panel")).toBeVisible();
  await expect(page.getByTestId("c1-scene")).toBeVisible();
  await expect(page.getByTestId("c1-map")).toBeVisible();
  await expect(page.getByTestId("c1-profile")).toBeVisible();
  await expect(page.getByTestId("c1-ledger")).toContainText("current total − baseline");
  await expect(page.getByTestId("c1-conclusion")).toContainText("prescribed профиль");

  await page.locator("#c1-channel").selectOption("DEFICIT_W0");
  await expect(page.locator("#c1-map-title")).toContainText("cavity deficit");
  await page.locator("#c1-channel").selectOption("BODY_W0");
  await expect(page.locator("#c1-map-title")).toContainText("central body");

  await page.locator("#c1-cavity-ratio").evaluate((element: HTMLInputElement) => {
    element.value = "2.8";
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#c1-cavity-ratio-value")).toHaveText("2.80");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#c1-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_C1_BODY_CAVITY_W_MAPS_RECEIPT.json");
  expect(errors).toEqual([]);
});
