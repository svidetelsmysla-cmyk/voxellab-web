import { expect, test } from "@playwright/test";


test("Operator Audit A1.1 shows the governed candidate family", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("./operator-audit/");
  const panel = page.getByTestId("candidate-family-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("MINIMAL_CONTROL_FAMILY_CONTAINS_EXACT_ZERO");
  await expect(panel).toContainText("NONFORWARD_CONTROL_HULL_EXCLUDES_ZERO");
  await expect(page.getByTestId("candidate-family-table").locator("tbody tr")).toHaveCount(5);
  await expect(page.getByTestId("candidate-family-chart")).toBeVisible();
  await expect(panel).toContainText("C0_FORWARD_TRANSMISSION");
  await expect(panel).toContainText("ZERO INCLUDED");
  await expect(panel).toContainText("ZERO EXCLUDED IN THIS FAMILY");
  expect(errors).toEqual([]);
});


test("candidate-family playback states its project-only ceiling", async ({ page }) => {
  await page.goto("./operator-audit/");
  const panel = page.getByTestId("candidate-family-panel");
  await expect(panel).toContainText("PROJECT_CONSTITUTIVE_CANDIDATES_NOT_VIKTOR_LAW");
  await expect(panel).toContainText("does not force a nonzero full response");
  await expect(panel).toContainText("family-specific");
  await expect(page.locator("footer")).toContainText("NO FIRST-HIT PROMOTION");
});
