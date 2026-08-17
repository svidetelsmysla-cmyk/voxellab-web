import { expect, test } from "@playwright/test";

test("Chrysanthemum external support scale panel exposes local closure diagnostics", async ({ page }) => {
  await page.goto("./action-lab/");
  const panel = page.locator("#action-lab-chrysanthemum-scale-v1");
  await expect(panel.getByRole("heading", { name: "Chrysanthemum · external support scale" })).toBeVisible();
  await expect(panel.locator("#chrys-readout")).toContainText("coverage=", { timeout: 30_000 });

  // K4 is the first fully covered sampled sky, but K3 still has a tiny uncovered set.
  // Move to K5 so the panel tests the physically relevant statement: K4 -> K5 adds
  // farther support without changing an already closed terminal-depth front.
  await panel.locator("#chrys-tiers").evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect(panel.locator("#chrys-readout")).toContainText("LOCAL TERMINAL FRONT SATURATED", { timeout: 30_000 });
  await expect(panel.locator("#chrys-hazard-readout")).toContainText("Nₖ=6k²", { timeout: 30_000 });
  await expect(panel.locator("#chrys-hazard-readout")).toContainText("open-sky exponential fit", { timeout: 30_000 });
  await expect(panel.locator("#chrys-sky")).toBeVisible();
  await expect(panel.locator("#chrys-owners")).toBeVisible();
  await expect(panel.locator("#chrys-scale-bridge")).toBeVisible();
});
