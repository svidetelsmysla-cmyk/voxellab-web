import { expect, test } from "@playwright/test";

test("G4 bridge audit exposes scoped gates, residuals and bounded channel coverage", async ({ page }) => {
  await page.goto("./");
  const panel = page.getByTestId("action-tally-audit");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("action-tally-audit-status")).toHaveText("PACKET_AUDIT_PASS_WITH_SCOPED_CONTROLS");
  await expect(page.getByTestId("action-tally-gates").locator(":scope > div")).toHaveCount(10);
  await expect(page.getByTestId("action-tally-metrics").locator(":scope > div")).toHaveCount(8);
  await expect(page.getByTestId("action-tally-branch-table").locator("tbody tr")).toHaveCount(5);
  await expect(page.getByTestId("action-tally-channel-table").locator("tbody tr")).toHaveCount(10);
  await expect(panel).toContainText("SI_TIME_AND_FORCE_UNIT_BINDING_DEFERRED_NOT_CURRENT_BLOCKER");
  await expect(panel).toContainText("R2_SPECULAR_CONTROL_ONLY_PASS");
  await expect(panel).toContainText("ONE_POINT_SYMMETRY_CONTROL_ONLY");
  await expect(panel).toContainText("NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1");
  await expect(panel).toContainText("SIGNED_DIAGNOSTIC");
  await expect(panel).toContainText("BOUNDED_SUMMARY_FROM_GOVERNED_PACKET_NO_CELL_ARRAYS");
});
