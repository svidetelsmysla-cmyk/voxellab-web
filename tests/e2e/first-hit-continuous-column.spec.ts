import { expect, test } from "@playwright/test";

test("Action Lab A3 exposes first-owner continuous-column semantics", async ({ page }) => {
  await page.goto("/action-lab/");
  const panel = page.getByTestId("a3-first-hit-column");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "First-hit continuous column" })).toBeVisible();
  await expect(panel.getByText("first contour entry → full chord")).toBeVisible();
  await expect(panel.getByText("FIRST_HIT_CONTINUOUS_COLUMN_BROWSER_METHOD_CONTROL")).toBeVisible();
  await expect(panel.locator("#a3-owner-atlas")).toHaveCount(1);
  await expect(panel.locator("#a3-column-atlas")).toHaveCount(1);

  await panel.locator("#a3-preset").selectOption("occluded-pair");
  await expect(panel.getByText("Two formed domains do not overlap in 3D")).toBeVisible();
  await expect(panel.getByText("K1 Column")).toBeVisible();
  await expect(panel.getByText("A3 first-owner column")).toBeVisible();
});
