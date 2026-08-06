import { expect, test } from "@playwright/test";

test("D0M separates free expansion from normalized shape in read-only playback", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./action-lab/");

  await expect(page.getByTestId("d0m-panel")).toBeVisible();
  await expect(page.getByTestId("d0m-size-canvas")).toBeVisible();
  await expect(page.getByTestId("d0m-shape-canvas")).toBeVisible();
  await expect(page.getByTestId("d0m-proxy-canvas")).toBeVisible();
  await expect(page.getByTestId("d0m-gates")).toContainText("G18");
  await expect(page.getByTestId("d0m-gates")).not.toContainText("FAIL");
  await expect(page.getByTestId("d0m-operator-audit")).toContainText("softening");
  await expect(page.getByTestId("d0m-operator-audit")).toContainText("forbidden/absent in D0M");
  await expect(page.getByTestId("d0m-conclusion")).toContainText("D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS");
  await expect(page.getByTestId("d0m-conclusion")).toContainText("открывает D0C");
  await expect(page.getByTestId("d0m-conclusion")).toContainText("Не установлены");
  await expect(page.getByTestId("d0m-provenance")).toContainText("d68e6e16954c21b19a32d0c7a90a5944d779fc44");
  await expect(page.getByTestId("d0m-provenance")).toContainText("3a5df4536699d244eafe3bd0d9ef85809bddf1b71928ce17967b6fcd34176078");

  await page.locator("#d0m-level").selectOption("N24");
  await page.locator("#d0m-milestone").selectOption("1.1");
  await expect(page.getByTestId("d0m-ledger")).toContainText("N24 at registered 1.10 milestone");
  await page.locator("#d0m-level").selectOption("N192");
  await page.locator("#d0m-milestone").selectOption("1.5");
  await expect(page.getByTestId("d0m-ledger")).toContainText("N192 at registered 1.50 milestone");
  await expect(page.getByTestId("d0m-ledger")).toContainText("0.0012435");
  await expect(page.getByTestId("d0m-refinement-table")).toContainText("N192");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#d0m-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("R13_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1.json");
  expect(errors).toEqual([]);
});
