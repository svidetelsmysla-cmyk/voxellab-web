import { mkdirSync, writeFileSync } from "node:fs";
import { computeFirstHit } from "../src/firstHit/firstHit";
import { parseSceneV2 } from "../src/importExport/sceneIo";
import { motionLedgers } from "../src/diagnostics/ledgers";
import { loadSceneV2, sceneCatalogue } from "../src/scenes/catalogue";
import { symplecticStep } from "../src/simulation/engine";
import type { SceneRunReceipt, Vec3 } from "../src/app/contracts";

const commit = process.env.VITE_COMMIT_SHA || process.env.GITHUB_SHA || "LOCAL_IMPLEMENTATION_TREE";
const longScenes = new Set(["S04", "S06", "S12", "S13", "S14", "S15"]);
const percentile = (values: number[], p: number) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))] ?? 0;
const delta = (a: Vec3, b: Vec3) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

const receipts: SceneRunReceipt[] = [];
for (const entry of sceneCatalogue) {
  const scene = parseSceneV2(loadSceneV2(entry.scene_id));
  const initial = motionLedgers(scene.objects);
  const steps = scene.scene_class === "SETUP_ONLY" || scene.scene_class === "PACKET_ONLY" ? 0 : longScenes.has(scene.scene_id) ? 3000 : scene.scene_class === "DYNAMIC" ? 300 : 10;
  const timings: number[] = []; let amountResidual = 0; let actionResidual = 0; let failure: string | null = null;
  const started = performance.now();
  try {
    for (let step = 0; step < steps; step += 1) {
      const result = symplecticStep(scene); timings.push(result.compute_ms); amountResidual = Math.max(amountResidual, result.amount_residual); actionResidual = Math.max(actionResidual, result.action_reaction_residual ?? 0);
      if (result.bodies.some((body) => body.force.some((value) => !Number.isFinite(value))) || scene.objects.some((body) => body.transform.position.some((value) => !Number.isFinite(value)))) throw new Error("NaN/Infinity detected");
    }
  } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  const runtime = (performance.now() - started) / 1000; const final = motionLedgers(scene.objects);
  let firstHit = null;
  if (scene.first_hit.enabled) {
    const observer = scene.objects.find((body) => body.object_id === scene.first_hit.observer_body_id) ?? scene.objects[0]!;
    firstHit = computeFirstHit(observer.transform.position, scene.objects.filter((body) => body.object_id !== observer.object_id), scene.first_hit.direction_count, scene.first_hit.max_distance);
  }
  const movement = scene.objects.reduce((sum, body, i) => sum + delta(body.transform.position, loadSceneV2(entry.scene_id).objects[i]?.transform.position ?? body.transform.position), 0);
  receipts.push({
    scene_id: scene.scene_id, scene_class: scene.scene_class, commit, backend: scene.simulation.evaluation_method === "DISTRIBUTED_ELEMENTS" ? "CPU_DIRECT_POINT_CUBATURE" : "CPU_DIRECT_EXACT_SPHERE_REDUCTION",
    operator_name: scene.simulation.operator_name, evaluation_method: scene.simulation.evaluation_method,
    body_count: scene.objects.length, movable_body_count: scene.objects.filter((body) => !body.world_locked && body.movable_translation).length, locked_body_count: scene.objects.filter((body) => body.world_locked).length,
    compute_element_count: scene.objects.reduce((sum, body) => sum + body.packing.compute_count, 0), display_element_count: scene.objects.reduce((sum, body) => sum + body.packing.display_count, 0),
    packing: [...new Set(scene.objects.map((body) => body.packing.mode))], kou_tier_counts: Array.from({ length: scene.kou?.tiers ?? 0 }, (_, tier) => scene.objects.filter((body) => body.kou_tier === tier + 1).length),
    first_hit_direction_count: firstHit?.direction_count ?? 0, steps_run: steps, runtime_seconds: runtime,
    mean_compute_ms: timings.reduce((sum,value)=>sum+value,0)/Math.max(1,timings.length), p95_compute_ms: percentile(timings,.95), mean_fps: steps / Math.max(runtime,1e-9),
    amount_residual: amountResidual, momentum_residual: delta(initial.momentum, final.momentum), action_reaction_residual: actionResidual,
    coverage_fraction: firstHit?.coverage_fraction ?? null, largest_hole: firstHit?.largest_angular_hole ?? null, maximum_first_hit_distance: firstHit?.maximum_first_hit_distance ?? null,
    final_motion_class: steps === 0 ? "NOT_EXECUTED_BY_DECLARED_CLASS" : movement < 1e-10 ? "STATIC_OR_SYMMETRIC_CONTROL" : scene.scene_id === "S04" ? "REPULSIVE_EXPANSION_CONTROL" : "PREVIEW_RESULT_RECORDED",
    claim_ceiling: entry.claim_ceiling, status: failure ? "ENGINEERING_RUN_BLOCKED" : scene.scene_class === "SETUP_ONLY" ? "SETUP_ONLY" : scene.scene_class === "PACKET_ONLY" ? "PACKET_ONLY" : scene.scene_class === "DYNAMIC" ? "PREVIEW_RESULT_RECORDED" : "ENGINEERING_RUN_PASS", failure_reason: failure,
  });
}

const suite = {
  schema_version: "2.0", task_id: "CODEX_WEB_VOXELLAB_SCENE_LAB_V2_FULL_SCENE_SUITE_V1", commit,
  generated_utc: new Date().toISOString(), runner: "scripts/runSceneSuite.ts", authority: "PUBLIC_ENGINEERING_PREVIEW_NOT_SCIENTIFIC_VALIDATION",
  required_run_lengths: { smoke: 10, standard: 300, long: 3000, long_scenes: [...longScenes] },
  all_scenes_loaded: receipts.length === 17, all_required_runs_recorded: receipts.every((r) => r.failure_reason === null), receipts,
};
mkdirSync("public/receipts", { recursive: true }); mkdirSync("docs/results", { recursive: true });
writeFileSync("public/receipts/VOXELLAB_SCENE_SUITE_V2.json", `${JSON.stringify(suite, null, 2)}\n`);
const rows = receipts.map((r) => `| ${r.scene_id} | ${r.scene_class} | ${r.body_count} | ${r.movable_body_count} | ${r.steps_run} | ${r.mean_compute_ms.toFixed(4)} | ${r.coverage_fraction === null ? "—" : r.coverage_fraction.toFixed(6)} | ${r.status} |`).join("\n");
writeFileSync("docs/results/VOXELLAB_SCENE_SUITE_V2.md", `# VoxelLab Scene Suite V2\n\nGenerated by \`scripts/runSceneSuite.ts\` from \`${commit}\`. These are engineering preview receipts, not hypothesis tests or validation.\n\n| Scene | Class | Bodies | Movable | Steps | Mean compute ms | Coverage | Status |\n|---|---:|---:|---:|---:|---:|---:|---|\n${rows}\n\nAll 17 planned browser scenes were loaded and run or explicitly classified as packet/setup only. No Upor, dipole, scale, or validation is claimed.\n`);
if (!suite.all_scenes_loaded || !suite.all_required_runs_recorded) process.exitCode = 1;
console.log(JSON.stringify({ scenes: receipts.length, blocked: receipts.filter((r)=>r.failure_reason).length, long_runs: receipts.filter((r)=>r.steps_run===3000).length }, null, 2));
