import { expect, test } from "@playwright/test";

test("Action Lab A4 exposes the continuous-field K2 bridge and the real-snapshot blocker", async ({ page }) => {
  await page.goto("./action-lab/");
  const panel = page.getByTestId("a4-continuous-field-action-bridge-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Continuous-field action bridge" })).toBeVisible();
  await expect(panel.getByTestId("a4-bridge-status")).toContainText("V14 SNAPSHOT EXPORT BLOCKER");
  await expect(panel.getByText("W1 = DIRECTIONAL ACTION MOMENT")).toBeVisible();
  await expect(panel.locator("#a4-density-slice")).toHaveCount(1);
  await expect(panel.locator("#a4-angular-map")).toHaveCount(1);
  await expect(panel.getByText("A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER")).toBeVisible();

  await panel.locator("#a4-fixture").selectOption("TWO_OWNER_COLUMN");
  await expect(panel.getByText("Synthetic disjoint two-owner control")).toBeVisible();
  await panel.locator("#a4-mode").selectOption("FIRST_REGISTERED_OWNER_COLUMN");
  await expect(panel.getByRole("cell", { name: "first registered owner", exact: true })).toBeVisible();

  await panel.locator("#a4-rx").fill("0.1");
  await panel.locator("#a4-run").click();
  await expect(panel.getByText("Read-only A4 readout recomputed.")).toBeVisible();
});
