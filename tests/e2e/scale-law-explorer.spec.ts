import { expect, test } from "@playwright/test";

test("Scale Law Explorer loads governed source and critical references", async ({ page }) => {
  await page.goto("./action-lab/");
  const panel = page.locator("#action-lab-scale-law-explorer-v1");
  await expect(panel.getByRole("heading", { name: "Scale Law Explorer" })).toBeVisible();
  await expect(panel.locator("#scale-law-status")).toContainText("PACKET VERIFIED", { timeout: 30_000 });
  await expect(panel.locator("#scale-fold-readout")).toContainText("qcrit");
  await expect(panel.locator("#scale-fold-readout")).toContainText("0.49");
  await expect(panel.locator("#scale-hierarchy-readout")).toContainText("D=ln(m)/ln(b)");
  await expect(panel.locator("#scale-uniformity")).toBeVisible();
  await expect(panel.locator("#scale-power")).toBeVisible();
});
