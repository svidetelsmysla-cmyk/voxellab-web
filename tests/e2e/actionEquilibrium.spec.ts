import { expect, test } from "@playwright/test";

test("A5 loads the frozen V14J equilibrium atlas without promoting W1 to force", async ({ page }) => {
  await page.goto("./action-lab/");
  const panel = page.getByTestId("action-equilibrium-map-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator("#eq-status")).toContainText("ROBUST DIAGNOSTIC");
  await expect(panel.locator("#eq-status")).toContainText("NOT YET PHYSICAL FORCE");
  await expect(page.getByTestId("equilibrium-map")).toBeVisible();
  await expect(panel.locator("#eq-roots tr")).toHaveCount(3);
  await expect(panel.locator("#eq-readout")).toContainText("hidden (late readout)");

  await panel.locator("#eq-boundary").selectOption("nearest");
  await expect(panel.locator("#eq-readout")).toContainText("nearest");
  await panel.locator("#eq-labels").check();
  await expect(panel.locator("#eq-readout")).not.toContainText("hidden (late readout)");
});
