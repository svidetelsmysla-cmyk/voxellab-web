import { describe, expect, it } from "vitest";
import maxFixture from "../public/fixtures/3dsmax/S17_VOXELLAB_MAX_EXPORT_FIXTURE_V1.voxellab.scene.json";
import { EditHistory } from "../src/editor/history";
import { computeFirstHit, fibonacciDirections, raySphereDistance } from "../src/firstHit/firstHit";
import { migrateSceneV1, parseSceneV2, serializeSceneV2 } from "../src/importExport/sceneIo";
import { expectedKouCount, generateKou, KOU_PRESETS } from "../src/kou/generateKou";
import { generatePacking, PACKING_TARGETS } from "../src/packing/generatePacking";
import { loadSceneV2, sceneCatalogue } from "../src/scenes/catalogue";
import { computeBodyPairs, symplecticStep } from "../src/simulation/engine";
import { analyticSphereCapArea, exactCapPolarGaussSphere, fixedFibonacciCurvedAngular, governedPlayback, V2B3C_GOLDEN } from "../src/simulation/curvedSolidAngle";
import { loadBuiltInScene } from "../src/scenes";

describe("SceneDocumentV2 and editor state", () => {
  it("migrates v1 and round-trips v2 mobility, transforms, groups and packing", () => {
    const migrated = migrateSceneV1(loadBuiltInScene("SCENE_03_MOVABLE_RIGID_VOLUME") as unknown as Record<string, unknown>);
    expect(migrated.scene_version).toBe("2.0");
    expect(migrated.simulation.damping_enabled).toBe(false);
    expect(parseSceneV2(JSON.parse(serializeSceneV2(migrated)))).toEqual(migrated);
  });
  it("undoes and redoes transform-gizmo state", () => {
    const history = new EditHistory({ position: [0, 0, 0] });
    history.push({ position: [1, 2, 3] });
    expect(history.undo().position).toEqual([0, 0, 0]);
    expect(history.redo().position).toEqual([1, 2, 3]);
  });
  it("loads all 17 preregistered scenes with explicit mobility", () => {
    expect(sceneCatalogue).toHaveLength(17);
    for (const item of sceneCatalogue) {
      const scene = parseSceneV2(loadSceneV2(item.scene_id));
      expect(scene.objects.length).toBeGreaterThan(0);
      expect(scene.objects.every((body) => typeof body.world_locked === "boolean")).toBe(true);
    }
  });
});

describe("multi-body symplectic preview and ledgers", () => {
  it("moves both S02 bodies and preserves pair action/reaction without hidden damping", () => {
    const scene = loadSceneV2("S02");
    const before = scene.objects.map((body) => [...body.transform.position]);
    const speeds = scene.objects.map((body) => Math.hypot(...body.velocity));
    const result = symplecticStep(scene);
    expect(scene.simulation.damping_enabled).toBe(false);
    expect(scene.objects.every((body, i) => body.transform.position.some((v, a) => v !== before[i]![a]))).toBe(true);
    expect(scene.objects.every((body, i) => Math.hypot(...body.velocity) >= speeds[i]!)).toBe(true);
    expect(result.action_reaction_residual).toBeLessThan(1e-12);
    expect(result.amount_residual).toBe(0);
  });
  it("honours lock/unlock fields and has finite momentum", () => {
    const scene = loadSceneV2("S02");
    scene.objects[0]!.world_locked = true;
    const position = [...scene.objects[0]!.transform.position];
    symplecticStep(scene);
    expect(scene.objects[0]!.transform.position).toEqual(position);
    expect(computeBodyPairs(scene).bodies.flatMap((body) => body.force).every(Number.isFinite)).toBe(true);
  });
  it("executes the named positive point-cubature route without collapsing rigid body identity", () => {
    const scene = loadSceneV2("S02");
    scene.simulation.evaluation_method = "DISTRIBUTED_ELEMENTS";
    scene.simulation.operator_name = "POINT_CUBATURE_FCC";
    const result = computeBodyPairs(scene);
    expect(result.evaluation_method).toBe("DISTRIBUTED_ELEMENTS");
    expect(result.bodies).toHaveLength(scene.objects.length);
    expect(result.bodies.flatMap((body) => body.torque).every(Number.isFinite)).toBe(true);
    expect(result.action_reaction_residual).toBeLessThan(1e-10);
  });
});

describe("genuine positive packing generators", () => {
  it.each(["SC", "BCC", "FCC", "HCP"] as const)("generates %s sphere-clipped, recentered and renormalized packing", (mode) => {
    const result = generatePacking(mode, "P2", 1, 7);
    expect(result.elements.length).toBeGreaterThanOrEqual(256);
    expect(result.elements.length).toBeLessThanOrEqual(PACKING_TARGETS.P2);
    expect(result.elements.reduce((sum, e) => sum + e.amount, 0)).toBeCloseTo(7, 12);
    const centre = [0, 1, 2].map((axis) => result.elements.reduce((sum, e) => sum + e.local_position[axis]!, 0) / result.elements.length);
    expect(Math.hypot(...centre)).toBeLessThan(1e-12);
    expect(result.elements.every((e) => e.amount > 0 && Math.hypot(...e.local_position) <= 1)).toBe(true);
  });
  it("keeps FCC, BCC, HCP and SC coordinate sets distinct", () => {
    const signatures = ["SC", "BCC", "FCC", "HCP"].map((mode) => JSON.stringify(generatePacking(mode as never, "P0", 1, 1).elements.slice(0, 12).map((e) => e.local_position)));
    expect(new Set(signatures).size).toBe(4);
  });
});

describe("exact antipodal KOU", () => {
  it.each([["TINY", 28], ["M0_K4", 180], ["M0_K6", 546]] as const)("generates %s with exact counts", (preset, expected) => {
    const config = { enabled: true, preset, m: KOU_PRESETS[preset].m, tiers: KOU_PRESETS[preset].tiers, tier_spacing: 1, body_amount: .02, body_radius: .1, near_movable_tiers: 1, guard_tiers: 1, far_fixed_tiers: 1, orientation_seed: 0, all_movable: false, hidden_tiers: [] as number[] };
    const bodies = generateKou(config);
    expect(bodies).toHaveLength(expected);
    expect(expectedKouCount(config.m, config.tiers)).toBe(expected);
    for (let i = 0; i < bodies.length; i += 2) expect(bodies[i + 1]!.transform.position).toEqual(bodies[i]!.transform.position.map((v) => -v));
    expect(bodies.some((body) => body.kou_role === "MOVABLE_BUFFER" && !body.world_locked)).toBe(true);
    expect(bodies.some((body) => body.kou_role === "FAR_EXTERNAL_CONTOUR" && body.world_locked)).toBe(true);
  });
});

describe("first-hit and chrysanthemum diagnostics", () => {
  it("solves ray/sphere intersections and open/closed sampled controls", () => {
    expect(raySphereDistance([0,0,0], [1,0,0], [3,0,0], 1)).toBeCloseTo(2, 12);
    expect(raySphereDistance([0,0,0], [0,1,0], [3,0,0], 1)).toBeNull();
    expect(fibonacciDirections(16384)).toHaveLength(16384);
    const open = loadSceneV2("S08"); const observer = open.objects[0]!;
    const result = computeFirstHit(observer.transform.position, open.objects.slice(1), 2048, 20);
    expect(result.coverage_fraction).toBeGreaterThan(0); expect(result.coverage_fraction).toBeLessThan(1); expect(result.distances).toHaveLength(2048);
  });
});

describe("3ds Max import and V2B3C governed golden parity", () => {
  it("imports the tracked three-group Max fixture and round trips it", () => {
    const parsed = parseSceneV2(maxFixture);
    expect(new Set(parsed.objects.map((body) => body.group_id)).size).toBe(3);
    expect(parsed.objects.some((body) => body.packing.mode === "FCC")).toBe(true);
    expect(parseSceneV2(JSON.parse(serializeSceneV2(parsed)))).toEqual(parsed);
  });
  it("separates P2, P3B sphere and future P3C while retaining blocker authority", () => {
    expect(analyticSphereCapArea(2, 1)).toBeCloseTo(2 * Math.PI * (1 - Math.sqrt(3) / 2), 14);
    const p2 = fixedFibonacciCurvedAngular([2.5,0,0], [0,0,0], 1, 1, 3072);
    const p3b = exactCapPolarGaussSphere([2.5,0,0], [0,0,0], 1, 1, 96);
    const p3c = governedPlayback("P3C_EXPLICIT_SPHERICAL_POLYGON_BOOLEAN_FUTURE");
    expect(p2.hit_mask.some(Boolean)).toBe(true);
    expect(p2.h_omega.every((value) => value >= 0)).toBe(true);
    expect(p2.golden_parity).toBe("NOT_ISSUED");
    expect(p3b.quadrature_family).toBe("EXACT_SPHERICAL_CAP_BOUNDARY_PLUS_POLAR_GAUSS");
    expect(p3c.authority).toBe("FUTURE_NOT_IMPLEMENTED");
    expect(V2B3C_GOLDEN.verdict).toBe("CURVED_SOLID_ANGLE_ANALYTIC_ORACLE_BLOCKER");
    expect(V2B3C_GOLDEN.p2_outlier_localization.status).toBe("CAUSE_NOT_YET_LOCALIZED");
    expect(V2B3C_GOLDEN.p3b_two_finest_relative_error_max).toBe(1.708497894455263e-7);
  });
});
