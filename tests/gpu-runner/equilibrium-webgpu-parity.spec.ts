import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE",
      "--use-angle=vulkan",
      "--use-vulkan=swiftshader",
      "--disable-vulkan-surface",
      "--enable-dawn-features=allow_unsafe_apis",
    ],
  },
});

test("real WebGPU compute pass agrees with the CPU reference", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("action-lab/");
  const panel = page.locator("#webgpu-equilibrium-regime-map-v1");
  await expect(panel.locator("#eq-status")).toContainText("PACKET VERIFIED", { timeout: 30_000 });
  await expect(panel.locator("#eq-backend")).toContainText(/WEBGPU ·|GPU BLOCKED/, { timeout: 90_000 });
  const backend = await panel.locator("#eq-backend").innerText();
  if (!backend.includes("WEBGPU ·")) throw new Error(`WebGPU execution blocker: ${await panel.locator("#eq-parity").innerText()}`);
  await panel.locator("#eq-frame").fill("12");
  await expect(panel.locator("#eq-parity")).toContainText("PASS", { timeout: 30_000 });
  await expect(panel.locator("#eq-parity")).toContainText("eigen sign 100.000%");
  expect(errors).toEqual([]);
});
