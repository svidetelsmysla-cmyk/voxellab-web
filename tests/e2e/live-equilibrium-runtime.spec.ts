import { expect, test } from "@playwright/test";

test("A5 runs a real browser-side equilibrium calculation instead of snapshot playback", async ({ page }) => {
  await page.goto("./action-lab/");
  const panel = page.getByTestId("a5-live-equilibrium-runtime");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Live equilibrium runtime" })).toBeVisible();
  await expect(panel.getByText("LIVE 2D REDUCED RUNTIME")).toBeVisible();
  await expect(panel.locator("#a5-canvas")).toHaveCount(1);

  const steps = panel.locator("#a5-m-steps");
  await expect(steps).toHaveText("0");
  await panel.locator("#a5-step").click();
  await expect(steps).toHaveText("1");

  await panel.locator("#a5-play").click();
  await expect(panel.locator("#a5-play")).toContainText("PAUSE");
  await page.waitForTimeout(180);
  await panel.locator("#a5-play").click();
  await expect(panel.locator("#a5-play")).toContainText("PLAY");
  expect(Number(await steps.textContent())).toBeGreaterThan(1);

  await panel.locator("#a5-beta").fill("0.76");
  await panel.locator("#a5-apply").click();
  await expect(steps).toHaveText("0");
  await expect(panel.locator("#a5-message")).toContainText("Applied live parameters");
});
