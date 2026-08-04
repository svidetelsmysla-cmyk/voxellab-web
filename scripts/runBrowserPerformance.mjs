import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4173/voxellab-web/";
const durationMs = Number(process.env.VOXELLAB_MEMORY_DURATION_MS ?? 300000);
const sampleIntervalMs = Number(process.env.VOXELLAB_MEMORY_SAMPLE_MS ?? 30000);
const browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info", "--enable-unsafe-webgpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
await page.goto(baseUrl, { waitUntil: "networkidle" });

async function select(sceneId) {
  await page.getByTestId("scene-select").selectOption(sceneId);
  await page.waitForTimeout(250);
}

async function rawFps(milliseconds = 2000) {
  return page.evaluate((ms) => new Promise((resolve) => {
    let frames = 0; const started = performance.now();
    const tick = (now) => { frames += 1; if (now - started >= ms) resolve(frames * 1000 / (now - started)); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), milliseconds);
}

async function computeCounts() {
  const rows = page.getByTestId("scene-tree").locator(".tree-row"), count = await rows.count(), values = [];
  for (let index = 0; index < count; index += 1) { await rows.nth(index).click(); values.push(Number(await page.locator("#compute-elements").textContent())); }
  return values;
}

async function stopLatency() {
  return page.evaluate(() => new Promise((resolve) => {
    const started = performance.now(); document.querySelector("#stop-button").click();
    const check = () => document.querySelector("#motion-status").textContent === "PAUSED" ? resolve(performance.now() - started) : requestAnimationFrame(check);
    check();
  }));
}

const benchmarks = [];
await select("S02"); const b1Counts = await computeCounts(); await page.getByTestId("run").click(); await page.waitForTimeout(500); const b1Fps = await rawFps(); const b1Stop = await stopLatency();
benchmarks.push({ id: "B1", scene_id: "S02", configured: `${b1Counts.length} bodies / ${b1Counts.join("+")} compute elements`, measured_fps: b1Fps, stop_latency_ms: b1Stop, target_met: b1Counts.length >= 2 && b1Counts.every((value) => value >= 512) && b1Fps >= 30 && b1Stop < 250 });

await select("S03"); const b2Instances = Number(await page.locator("#visible-instances").textContent()); const b2Fps = await rawFps();
benchmarks.push({ id: "B2", scene_id: "S03", configured_visible_instances: b2Instances, measured_fps: b2Fps, target_met: b2Instances >= 20000 && b2Fps >= 30 });

await select("S05"); const b3Bodies = await page.getByTestId("scene-tree").locator(".tree-row").count(); const b3Fps = await rawFps();
benchmarks.push({ id: "B3", scene_id: "S05", configured_bodies: b3Bodies, measured_fps: b3Fps, target_met: b3Bodies >= 181 && b3Fps >= 30 });

await select("S04"); const b4Bodies = await page.getByTestId("scene-tree").locator(".tree-row").count(); await page.getByTestId("run").click(); await page.waitForTimeout(500); const b4Fps = await rawFps(); const b4Stop = await stopLatency();
benchmarks.push({ id: "B4", scene_id: "S04", simultaneously_movable_bodies: b4Bodies, measured_fps: b4Fps, stop_latency_ms: b4Stop, target_met: b4Bodies >= 50 && b4Fps >= 30 && b4Stop < 250 });

await select("S09"); const firstHitStarted = performance.now(); await page.locator("#firsthit-run").click(); const firstHitLatency = performance.now() - firstHitStarted; const firstHitText = await page.locator("#firsthit-status").textContent(); const b5Fps = await rawFps();
benchmarks.push({ id: "B5", scene_id: "S09", direction_count: 16384, compute_latency_ms: firstHitLatency, measured_fps: b5Fps, closure_status: firstHitText, target_met: firstHitText.includes("16384:") && b5Fps >= 30 });

await select("S04"); await page.locator("#speed-preset").selectOption("FAST"); await page.getByTestId("run").click();
const memorySamples = [], memoryStarted = performance.now();
while (performance.now() - memoryStarted < durationMs) {
  await page.waitForTimeout(Math.min(sampleIntervalMs, durationMs - (performance.now() - memoryStarted)));
  const sample = await page.evaluate(() => ({ used_js_heap_bytes: performance.memory?.usedJSHeapSize ?? null, total_js_heap_bytes: performance.memory?.totalJSHeapSize ?? null }));
  memorySamples.push({ elapsed_ms: performance.now() - memoryStarted, ...sample, fps: await rawFps(1000) });
}
const memoryStopLatency = await stopLatency();
const usableMemory = memorySamples.map((sample) => sample.used_js_heap_bytes).filter((value) => value !== null);
const memoryGrowth = usableMemory.length > 1 ? usableMemory.at(-1) - usableMemory[0] : null;
const memoryBaseline = usableMemory[0] ?? null;
const memoryBounded = memoryGrowth === null ? null : memoryGrowth <= Math.max(20 * 1024 * 1024, memoryBaseline * .25);
const webgpuStatus = await page.getByTestId("webgpu-status").textContent();
const receipt = {
  schema_version: "1.0", task_id: "CODEX_WEB_VOXELLAB_SCENE_LAB_V2_FULL_SCENE_SUITE_V1", generated_utc: new Date().toISOString(),
  environment: "LOCAL_DESKTOP_PLAYWRIGHT_CHROMIUM_HEADLESS", base_url: baseUrl, duration_ms: durationMs,
  targets: { minimum_fps: 30, maximum_stop_latency_ms: 250, memory_window_ms: 300000 },
  cpu_webgpu_parity: webgpuStatus, benchmarks,
  memory: { samples: memorySamples, growth_bytes: memoryGrowth, bounded_growth: memoryBounded, stop_latency_ms: memoryStopLatency },
  console_errors: consoleErrors,
  all_targets_met: benchmarks.every((item) => item.target_met) && memoryBounded === true && memoryStopLatency < 250 && consoleErrors.length === 0,
  authority: "LOCAL_BROWSER_ENGINEERING_BENCHMARK_NOT_SCIENTIFIC_VALIDATION",
};
mkdirSync("public/receipts", { recursive: true });
writeFileSync("public/receipts/VOXELLAB_SCENE_LAB_V2_PERFORMANCE.json", `${JSON.stringify(receipt, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({ all_targets_met: receipt.all_targets_met, benchmarks, memory_growth_bytes: memoryGrowth, memory_bounded: memoryBounded, cpu_webgpu_parity: webgpuStatus, console_errors: consoleErrors.length }, null, 2));
if (!receipt.all_targets_met) process.exitCode = 1;
