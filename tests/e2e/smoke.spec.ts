import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /VoxelLab Scene Lab/ })).toBeVisible();
  await expect(page.getByTestId("viewport")).toBeVisible();
  await expect(page.getByTestId("webgpu-status")).not.toContainText("checking");
  expect(errors).toEqual([]);
});

test("wide speed, multi-body motion, editing, packing and JSON round trip", async ({ page }) => {
  await page.locator("#speed-preset").selectOption("MAX");
  await expect(page.locator("#playback-value")).toContainText("1000");
  await expect(page.locator("#damping-enabled")).not.toBeChecked();
  const rows = page.getByTestId("scene-tree").locator(".tree-row");
  await expect(rows).toHaveCount(2);
  const beforeA = await page.locator("#viewport").getAttribute("data-selected-position");
  await rows.nth(1).click(); const beforeB = await page.locator("#viewport").getAttribute("data-selected-position");
  await page.getByTestId("step").click(); await rows.nth(0).click(); await expect.poll(() => page.locator("#viewport").getAttribute("data-selected-position")).not.toBe(beforeA);
  await rows.nth(1).click(); await expect.poll(() => page.locator("#viewport").getAttribute("data-selected-position")).not.toBe(beforeB);
  await page.locator("#pos-x").fill("2.75"); await page.locator("#pos-x").press("Enter"); await expect(page.locator("#viewport")).toHaveAttribute("data-selected-position", /2.75/);
  await page.locator("#vel-x").fill("0.42"); await page.locator("#vel-x").press("Enter");
  await page.locator("#packing-mode").selectOption("FCC"); await page.locator("#packing-level").selectOption("P3"); await expect(page.locator("#display-elements")).not.toHaveText("27");
  const downloadPromise = page.waitForEvent("download"); await page.getByTestId("export-scene").click(); const download = await downloadPromise; const path = await download.path();
  expect(download.suggestedFilename()).toContain(".voxellab.scene.json"); await page.getByTestId("scene-file").setInputFiles(path!); await expect(page.locator("#file-status")).toContainText("Loaded scene"); await page.getByTestId("scene-tree").locator(".tree-row").nth(1).click(); await expect(page.locator("#pos-x")).toHaveValue("2.75"); await expect(page.locator("#vel-x")).toHaveValue("0.42");
});

test("layered KOU, first-hit sky, chrysanthemum and operator switch", async ({ page }) => {
  await page.getByTestId("scene-select").selectOption("S06"); await page.locator("#all-kou-movable").check();
  await expect(page.getByTestId("scene-tree").locator(".tree-row")).toHaveCount(181); await expect(page.locator("#kou-status")).toContainText("tier 4=96");
  await page.locator("#kou-tier").fill("4"); await page.locator("#select-kou-tier").click(); await expect(page.locator("#selected-name")).toContainText("KOU tier 4"); await page.locator("#hide-kou-tier").click(); await page.locator("#show-kou-tier").click(); await page.locator("#lock-kou-tier").click(); await page.locator("#unlock-kou-tier").click(); await page.locator("#kou-tier-role").selectOption("NUMERICAL_EDGE_DIAGNOSTIC"); await page.locator("#apply-kou-role").click(); await page.locator("#rotate-kou").click();
  await page.getByTestId("scene-select").selectOption("S08"); await page.locator("#firsthit-run").click(); await expect(page.locator("#firsthit-status")).toContainText("coverage convergence");
  await page.locator("[data-mode='CHRYSANTHEMUM']").click(); await expect(page.getByTestId("sky-map")).toBeVisible();
  await page.getByTestId("angular-operator").selectOption("P3A_ADAPTIVE_CURVED_ANGULAR"); await expect(page.locator("#angular-status")).toContainText("CURVED_SOLID_ANGLE_ANALYTIC_ORACLE_BLOCKER");
  await expect(page.getByTestId("angular-metadata")).toContainText("ADAPTIVE_SPHERICAL_TESSELLATION");
  await page.getByTestId("angular-operator").selectOption("P2_FIXED_FIBONACCI_CURVED_ANGULAR"); await expect(page.locator("#angular-status")).toContainText("sampled hits"); await expect(page.locator("#p2-outlier")).toContainText("Cause is not localized");
  await page.getByTestId("angular-operator").selectOption("P3B_EXACT_CAP_SPHERE"); await expect(page.getByTestId("angular-metadata")).toContainText("EXACT_SPHERICAL_CAP_BOUNDARY_PLUS_POLAR_GAUSS"); await expect(page.getByTestId("angular-metadata")).toContainText("NOT_ISSUED");
  await page.getByTestId("angular-operator").selectOption("P3C_EXPLICIT_SPHERICAL_POLYGON_BOOLEAN_FUTURE"); await expect(page.getByTestId("angular-metadata")).toContainText("FUTURE_NOT_IMPLEMENTED");
  await page.getByTestId("scene-select").selectOption("S02"); await expect(page.locator("#visible-instances")).toHaveText("1026");
});

test("all 17 scenes load without console error and transport remains functional", async ({ page }) => {
  const errors: string[] = []; page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  for (let i = 1; i <= 17; i += 1) { const id = `S${String(i).padStart(2,"0")}`; await page.getByTestId("scene-select").selectOption(id); await expect(page.locator("#viewport-title")).not.toBeEmpty(); }
  await page.getByTestId("scene-select").selectOption("S02"); await page.getByTestId("run").click(); await expect(page.locator("#motion-status")).toHaveText("RUNNING"); await page.getByTestId("stop").click(); await expect(page.locator("#motion-status")).toHaveText("PAUSED"); await page.getByTestId("step").click(); await page.getByTestId("reset").click();
  expect(errors).toEqual([]);
});

test("3ds Max fixture loads and scene catalogue opens", async ({ page }) => {
  await page.locator("#load-max-fixture").click(); await expect(page.locator("#file-status")).toContainText("3ds Max exporter fixture"); await expect(page.getByTestId("scene-tree").locator(".tree-row")).toHaveCount(3);
  await expect(page.getByTestId("scene-catalogue").locator("tbody tr")).toHaveCount(17);
});

test("governed G4 ActionTally playback preserves the cadence blocker", async ({ page }) => {
  await expect(page.locator("#action-tally-packet-status")).toContainText("ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS");
  await page.getByTestId("action-tally-branch").selectOption("R2_SPECULAR_REDIRECTION");
  await page.getByTestId("action-tally-body").selectOption("structure");
  await expect(page.locator("#action-tally-status")).toContainText("R2_SPECULAR_REDIRECTION · structure");
  await expect(page.getByTestId("action-tally-metadata")).toContainText("CADENCE_TO_FORCE_BLOCKER");
  await expect(page.getByTestId("action-tally-metadata")).toContainText("CELL_INTEGRATED_NO_SECOND_SOLID_ANGLE_WEIGHT");
  await expect(page.getByTestId("action-tally-map")).toBeVisible();
});

test("capture required public engineering screenshots", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 1050 });
  const capture = async (name: string) => page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: true });
  await page.locator("#pos-x").fill("-0.65"); await page.locator("#pos-x").press("Enter"); await capture("SCENE_LAB_V2_TRANSFORM_EDIT");
  await page.locator("#packing-mode").selectOption("FCC"); await page.locator("#packing-level").selectOption("P3"); await capture("SCENE_LAB_V2_FCC_BODY");
  await page.getByTestId("scene-select").selectOption("S05"); await capture("SCENE_LAB_V2_LAYERED_KOU");
  await page.getByTestId("scene-select").selectOption("S08"); await page.locator("#firsthit-run").click(); await capture("SCENE_LAB_V2_FIRST_HIT_SKY"); await page.locator("[data-mode='CHRYSANTHEMUM']").click(); await capture("SCENE_LAB_V2_CHRYSANTHEMUM");
  await page.getByTestId("scene-select").selectOption("S02"); await page.getByTestId("step").click(); await capture("SCENE_LAB_V2_TWO_MOVABLE_BODIES");
  await capture("SCENE_LAB_V2_SCENE_CATALOGUE"); await page.locator("#load-max-fixture").click(); await capture("SCENE_LAB_V2_3DSMAX_FIXTURE");
});
