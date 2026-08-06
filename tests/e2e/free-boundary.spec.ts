import { expect, test } from "@playwright/test";

test("A2B treats the overlap lens as displacement demand, not shared physical matter", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");

  await expect(page.getByTestId("free-boundary-a2b-panel")).toBeVisible();
  await expect(page.getByTestId("a2b-geometry")).toBeVisible();
  await expect(page.getByTestId("a2b-bounds-chart")).toBeVisible();
  await expect(page.getByTestId("a2b-parity")).toContainText("PASS");
  await expect(page.getByTestId("a2b-ledger")).toContainText("0.03352985");
  await expect(page.getByTestId("a2b-verdict")).toContainText("Каждый сгусток обязан вывести");
  await expect(page.getByTestId("a2b-conclusion")).toContainText("CONSTITUTIVE_LAW_BLOCKER");
  await expect(page.getByTestId("a2b-branches")).toContainText("B1 DISTINCT CLUMPS");

  await page.locator("#a2b-contact").click();
  await expect(page.locator("#a2b-separation-value")).toHaveText("2.000");
  await expect(page.getByTestId("a2b-verdict")).toContainText("равна нулю");

  await page.locator("#a2b-peak").click();
  await expect(page.locator("#a2b-separation-value")).toHaveText("0.732");
  await expect(page.getByTestId("a2b-parity")).toContainText("PASS");
  await expect(page.getByTestId("a2b-ledger")).toContainText("0.0736");

  await page.locator("#a2b-concentric").click();
  await expect(page.locator("#a2b-separation-value")).toHaveText("0.000");
  await expect(page.getByTestId("a2b-verdict")).toContainText("topology blocker");

  await page.locator("#a2b-default").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#a2b-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("VOXELLAB_ACTION_TRANSPORT_A2B_FREE_BOUNDARY_BOUNDS_RECEIPT.json");
  expect(errors).toEqual([]);
});
