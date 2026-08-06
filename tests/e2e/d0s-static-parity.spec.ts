import { expect, test } from "@playwright/test";

test("D0S displays the preregistered static equal-microbody parity gate", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");

  await expect(page.getByTestId("d0s-panel")).toBeVisible();
  await expect(page.getByTestId("d0s-packing-canvas")).toBeVisible();
  await expect(page.getByTestId("d0s-refinement-canvas")).toBeVisible();
  await expect(page.getByTestId("d0s-gates")).toContainText("G17");
  await expect(page.getByTestId("d0s-gates")).not.toContainText("FAIL");
  await expect(page.getByTestId("d0s-conclusion")).toContainText("D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS");
  await expect(page.getByTestId("d0s-conclusion")).toContainText("D0M");
  await expect(page.getByTestId("d0s-conclusion")).toContainText("Никакой физический упор");

  await page.locator("#d0s-level").selectOption("N48");
  await expect(page.getByTestId("d0s-metrics")).toContainText("N48 fixed microbodies");
  await page.locator("#d0s-level").selectOption("N3072");
  await expect(page.getByTestId("d0s-metrics")).toContainText("N3072 fixed microbodies");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#d0s-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_D0S_STATIC_MICROBODY_PARITY_RECEIPT_V1.json");
  expect(errors).toEqual([]);
});
