import { expect, test } from "@playwright/test";

test("V14K2R verifies the governed N54 packet and keeps W1 separate from source force", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("action-lab/");
  const panel = page.locator("#v14k2r-multichannel-g11r-v1");
  await expect(panel).toBeVisible();
  await expect(panel.locator("#v14k2r-status")).toContainText("PACKET VERIFIED", { timeout: 90_000 });
  await expect(panel).toContainText("W1 is action readout, not total source force");
  await expect(panel).toContainText("N54");
  await expect(panel.locator("#v14k2r-semantics")).toContainText("SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM", { timeout: 90_000 });
  const fullTimeline = panel.locator("#v14k2r-full-timeline");
  await expect(fullTimeline).toContainText("N54_TOTAL_FORCE_RESTORING_BRANCH_PASS_DIAGNOSTIC", { timeout: 90_000 });
  await expect(fullTimeline).toContainText("N54_DENSITY_FOLLOWING_FAIL");
  await expect(fullTimeline).toContainText("1,256,866 total roots");

  const channel = panel.locator("#v14k2r-channel");
  await expect(channel.locator("option")).toHaveCount(5);
  await channel.selectOption("ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC");
  await expect(panel.locator("#v14k2r-semantics")).toContainText("NOT_SOURCE_FORCE", { timeout: 90_000 });
  expect(errors).toEqual([]);
});
