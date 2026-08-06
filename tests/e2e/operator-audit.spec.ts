import { expect, test } from "@playwright/test";


test("Operator Audit A1 loads the governed operator discriminator", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("./operator-audit/");
  await expect(page.getByRole("heading", { name: /Operator Audit/ })).toBeVisible();
  await expect(page.locator("#main-verdict")).toHaveText("ADDITIVE_SOURCE_ZERO_FIRST_HIT_NONZERO_OPERATOR_DELTA_PASS");
  await expect(page.locator("#source-verdict")).toHaveText("SOURCE_REDIRECTION_CONSTITUTIVE_LAW_NOT_FOUND");
  await expect(page.locator("#reachable-status")).toHaveText("NOT_IDENTIFIED");
  await expect(page.locator("#si-status")).toHaveText("DEFERRED");
  await expect(page.getByTestId("lane-list").locator(".lane-row")).toHaveCount(4);
  await expect(page.getByTestId("matched-scene")).toBeVisible();
  await expect(page.getByTestId("lane-chart")).toBeVisible();
  await expect(page.getByTestId("refinement-chart")).toBeVisible();
  await expect(page.getByTestId("interval-chart")).toBeVisible();
  expect(errors).toEqual([]);
});


test("Operator Audit A1 states the source and claim boundaries visibly", async ({ page }) => {
  await page.goto("./operator-audit/");
  await expect(page.locator("body")).toContainText("SOURCE ADDITIVE A−B");
  await expect(page.locator("body")).toContainText("PROJECT FIRST-HIT A−B");
  await expect(page.locator("body")).toContainText("first-hit direct-channel termination");
  await expect(page.locator(".firewall-box")).toContainText("Dimensionless operator delta available");
  await expect(page.locator("body")).toContainText("NO FIRST-HIT PROMOTION");
  await expect(page.getByRole("link", { name: /Scene Lab/ })).toHaveAttribute("href", "/voxellab-web/");
  await expect(page.getByRole("link", { name: /Action Transport Lab/ })).toHaveAttribute("href", "/voxellab-web/action-lab/");
});


test("Scene Lab and Action Lab both link to Operator Audit A1", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("operator-audit-link")).toHaveAttribute("href", "/voxellab-web/operator-audit/");
  await page.goto("./action-lab/");
  await expect(page.getByTestId("operator-audit-link")).toHaveAttribute("href", "/voxellab-web/operator-audit/");
});
