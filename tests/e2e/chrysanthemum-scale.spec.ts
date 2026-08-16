import { expect, test } from "@playwright/test";

test("Chrysanthemum external support scale panel exposes local closure diagnostics", async ({ page }) => {
  await page.goto("./action-lab/");
  const panel = page.locator("#action-lab-chrysanthemum-scale-v1");
  await expect(panel.getByRole("heading", { name: "Chrysanthemum · external support scale" })).toBeVisible();
  await expect(panel.locator("#chrys-readout")).toContainText("coverage=", { timeout: 30_000 });
  await expect(panel.locator("#chrys-readout")).toContainText("LOCAL TERMINAL FRONT SATURATED", { timeout: 30_000 });
  await expect(panel.locator("#chrys-sky")).toBeVisible();
  await expect(panel.locator("#chrys-owners")).toBeVisible();
});
