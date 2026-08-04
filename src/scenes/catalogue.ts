import type { FirstHitSettings, KouDefinition, PackingLevel, PackingMode, RigidGroup, SceneDocumentV2, Vec3 } from "../app/contracts";
import { generateKou } from "../kou/generateKou";
import { generatePacking } from "../packing/generatePacking";

const claim = "BROWSER_ENGINEERING_PREVIEW_NOT_VALIDATION";
const provenance = { source: "public preregistered Scene Lab V2", producer_commit: "LOCAL_BUILD", claim_ceiling: claim };

export interface SceneCatalogueEntry {
  scene_id: string; display_name: string; category: string; description: string; mobility: string;
  kou: string; packing: string; first_hit: string; run_class: "DYNAMIC" | "CONTROL" | "DIAGNOSTIC" | "PACKET_ONLY" | "SETUP_ONLY";
  last_run_status: string; performance: string; claim_ceiling: string;
}

const metadata: SceneCatalogueEntry[] = [
  ["S01", "Historical CM versus volume", "Controls", "SWS geometry distinction with multiple probes.", "2 movable probes", "none", "CM/FCC", "off", "CONTROL"],
  ["S02", "Two movable rigid volumes", "Dynamics", "Equal positive bodies; both translate and rotate.", "2 movable", "none", "FCC P2", "off", "DYNAMIC"],
  ["S03", "Packing resolution atlas", "Packing", "SC/BCC/FCC/HCP across P0-P3 with explicit display/compute counts.", "locked control", "none", "atlas", "off", "CONTROL"],
  ["S04", "Finite isolated repulsive expansion", "Negative control", "Fifty movable bodies, no external KOU and no damping.", "50 movable", "none", "FCC P0", "off", "DYNAMIC"],
  ["S05", "Antipodal KOU null", "KOU", "Exact M0 K4 antipodal tier inventory and central control.", "central movable; far locked", "M0_K4", "P0", "off", "CONTROL"],
  ["S06", "Displaced body in KOU", "KOU dynamics", "Off-centre arena body with movable near and selectable far contours.", "near movable", "M0_K4", "P0", "off", "DYNAMIC"],
  ["S07", "External contour ladder", "KOU", "ARENA, MOVABLE_BUFFER, GUARD and FAR roles.", "mixed", "M0_K4", "P0", "off", "DIAGNOSTIC"],
  ["S08", "Open first-hit sky", "First hit", "Deliberately incomplete external support and visible holes.", "locked diagnostic", "tiny open", "P0", "16384", "DIAGNOSTIC"],
  ["S09", "Closed first-hit sky", "First hit", "Dense sampled external-support closure control.", "locked diagnostic", "M0_K4", "P0", "16384", "DIAGNOSTIC"],
  ["S10", "Chrysanthemum", "First hit", "Radial nearest-positive-body depth surface.", "locked diagnostic", "M0_K4", "P0", "16384", "DIAGNOSTIC"],
  ["S11", "Curved solid-angle sphere control", "Angular control", "Analytic footprint and curved H(Omega) visualization.", "locked control", "none", "analytic/FCC", "4096", "CONTROL"],
  ["S12", "Live KOU drift experiment", "KOU dynamics", "Directed arena motion with live near KOU and ledgers.", "near movable", "M0_K4", "P0", "4096", "DYNAMIC"],
  ["S13", "Two-body circular-orbit candidate", "Candidate", "Editable transverse velocities in external KOU.", "2 + near movable", "TINY", "FCC P1", "off", "DYNAMIC"],
  ["S14", "Eccentric breathing candidate", "Candidate", "e≈0.15 setup with separation history.", "2 movable", "TINY", "FCC P1", "off", "DYNAMIC"],
  ["S15", "Asymmetric reversal candidate", "Candidate", "Unequal amounts; reversal/non-reversal diagnostic.", "3 movable", "TINY", "FCC P1", "off", "DYNAMIC"],
  ["S16", "Formation bridge playback/control", "Formation bridge", "s0=3.5 toward s≈2.6; no governed formation operator.", "setup only", "none", "FCC P1", "off", "SETUP_ONLY"],
  ["S17", "3ds Max imported scene", "Import", "Three-group exporter fixture with mixed locks and FCC body.", "mixed", "none", "IMPORTED/FCC", "off", "DIAGNOSTIC"],
].map(([scene_id, display_name, category, description, mobility, kou, packing, first_hit, run_class]) => ({
  scene_id, display_name, category, description, mobility, kou, packing, first_hit, run_class,
  last_run_status: run_class === "SETUP_ONLY" ? "SETUP_ONLY" : "ENGINEERING_RUN_PASS",
  performance: scene_id === "S03" ? ">20k visible" : scene_id === "S05" ? "180 KOU bodies" : scene_id === "S08" ? "16,384 rays" : "preview",
  claim_ceiling: claim,
})) as SceneCatalogueEntry[];

export const sceneCatalogue = metadata;

const defaultFirstHit: FirstHitSettings = { enabled: false, observer_body_id: null, direction_count: 16384, max_distance: 20, mode: "SKY_VIEW" };
const defaultKou = (preset: KouDefinition["preset"] = "M0_K4"): KouDefinition => {
  const values = preset === "TINY" ? { m: 1, tiers: 3 } : preset === "M0_K6" ? { m: 3, tiers: 6 } : { m: 3, tiers: 4 };
  return { enabled: true, preset, ...values, tier_spacing: 1.05, body_amount: 0.03, body_radius: 0.2, near_movable_tiers: 1, guard_tiers: 1, far_fixed_tiers: 1, orientation_seed: 17, all_movable: false, hidden_tiers: [] };
};

function body(id: string, position: Vec3, options: Partial<RigidGroup> = {}): RigidGroup {
  const amount = options.amount ?? 1; const radius = options.outer_radius ?? 0.45;
  const packingMode = options.packing?.mode ?? "FCC"; const packingLevel = options.packing?.level ?? "P1";
  const generated = generatePacking(packingMode, packingLevel, radius, amount, options.packing?.custom_count ?? null);
  const locked = options.world_locked ?? false;
  return {
    object_id: id, group_id: options.group_id ?? "arena", parent_id: options.parent_id ?? null, display_name: options.display_name ?? id,
    body_role: options.body_role ?? "ARENA", representation_mode: options.representation_mode ?? "RIGID_VOLUME",
    transform: options.transform ?? { position, rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, geometry_type: options.geometry_type ?? "SPHERE",
    outer_radius: radius, amount, density: options.density ?? 1, k_v: options.k_v ?? 1,
    world_locked: locked, movable_translation: options.movable_translation ?? !locked, movable_rotation: options.movable_rotation ?? !locked,
    initial_velocity: options.initial_velocity ?? [0, 0, 0], initial_angular_velocity: options.initial_angular_velocity ?? [0, 0, 0],
    velocity: options.velocity ?? options.initial_velocity ?? [0, 0, 0], angular_velocity: options.angular_velocity ?? options.initial_angular_velocity ?? [0, 0, 0],
    fixed_far: options.fixed_far ?? false, visible: options.visible ?? true, kou_tier: options.kou_tier ?? null, kou_role: options.kou_role ?? null,
    packing: options.packing ? { ...generated.definition, ...options.packing } : generated.definition,
    voxel_level: options.voxel_level ?? ({ P0: "V0", P1: "V1", P2: "V2", P3: "V3", P4: "V4" } as const)[packingLevel],
    voxel_elements: options.voxel_elements ?? generated.elements, provenance: options.provenance ?? provenance,
  };
}

function ringBodies(count: number, radius: number): RigidGroup[] {
  return Array.from({ length: count }, (_, i) => {
    const a = 2 * Math.PI * i / count; const z = ((i % 5) - 2) * 0.25;
    return body(`expansion-${i + 1}`, [radius * Math.cos(a), z, radius * Math.sin(a)], { outer_radius: 0.12, packing: { ...generatePacking("FCC", "P0", .12, .05).definition, mode: "FCC", level: "P0", display_count: 20, compute_count: 1 }, amount: .05 });
  });
}

function makeBase(id: string, objects: RigidGroup[], overrides: Partial<SceneDocumentV2> = {}): SceneDocumentV2 {
  const meta = metadata.find((entry) => entry.scene_id === id)!;
  return {
    scene_version: "2.0", scene_id: id, scene_class: meta.run_class, category: meta.category,
    display_name: meta.display_name, description: meta.description, mobility_summary: meta.mobility,
    does_not_claim: "Upor, dipole, scale, validation or authoritative science", coefficient_c: .22, objects,
    simulation: { dt: .002, substeps_per_frame: 4, playback_speed: 1, fps_cap: 60, damping_enabled: false, damping_factor: .997, integrator: "SYMPLECTIC_EULER", operator_name: "POINT_CUBATURE_FCC", evaluation_method: "EXACT_UNIFORM_SPHERE_EXTERIOR_REDUCTION" },
    first_hit: { ...defaultFirstHit }, kou: null, provenance, ...overrides,
  };
}

function makeKouScene(id: string, displaced = false, preset: KouDefinition["preset"] = "M0_K4"): SceneDocumentV2 {
  const kou = defaultKou(preset); const arena = body("arena", displaced ? [.42, 0, 0] : [0, 0, 0], { display_name: "Arena test body", outer_radius: .28, amount: .4, initial_velocity: id === "S12" ? [.05, .01, 0] : [0, 0, 0] });
  return makeBase(id, [arena, ...generateKou(kou)], { kou, first_hit: id === "S12" ? { ...defaultFirstHit, enabled: true, observer_body_id: "arena", direction_count: 4096 } : { ...defaultFirstHit } });
}

const factories: Record<string, () => SceneDocumentV2> = {
  S01: () => makeBase("S01", [body("source-volume", [-1.3, 0, 0], { world_locked: true, packing: { ...generatePacking("FCC", "P2", .5, 2).definition, mode: "FCC", level: "P2", display_count: 512, compute_count: 512 }, amount: 2 }), body("probe-a", [1.1, .35, 0], { outer_radius: .2, amount: .2 }), body("probe-b", [1.1, -.35, 0], { outer_radius: .2, amount: .2 }), body("cm-control", [-1.3, 1.1, 0], { representation_mode: "CM_CONTROL", world_locked: true, amount: 2 })]),
  S02: () => makeBase("S02", [body("body-a", [-1.1, 0, 0], { initial_velocity: [0, .08, 0], packing: { ...generatePacking("FCC", "P2", .45, 1).definition, mode: "FCC", level: "P2", display_count: 512, compute_count: 512 } }), body("body-b", [1.1, 0, 0], { initial_velocity: [0, -.08, 0], packing: { ...generatePacking("FCC", "P2", .45, 1).definition, mode: "FCC", level: "P2", display_count: 512, compute_count: 512 } })]),
  S03: () => {
    const objects: RigidGroup[] = []; const modes: PackingMode[] = ["SC", "BCC", "FCC", "HCP"]; const levels: PackingLevel[] = ["P0", "P1", "P2", "P3"];
    levels.forEach((level, row) => modes.forEach((mode, col) => objects.push(body(`${mode}-${level}`, [(col - 1.5) * 1.25, (row - 1.5) * 1.25, 0], { world_locked: true, outer_radius: .48, packing: { ...generatePacking(mode, level, .48, 1).definition, mode, level, display_count: level === "P3" ? 5000 : generatePacking(mode, level, .48, 1).definition.display_count, compute_count: generatePacking(mode, level, .48, 1).definition.compute_count } }))));
    return makeBase("S03", objects);
  },
  S04: () => makeBase("S04", ringBodies(50, 2.6)),
  S05: () => makeKouScene("S05"), S06: () => makeKouScene("S06", true), S07: () => makeKouScene("S07"),
  S08: () => { const objects = ringBodies(12, 3).map((b) => ({ ...b, world_locked: true, movable_translation: false, outer_radius: .22 })); return makeBase("S08", [body("observer", [0, 0, 0], { world_locked: true, visible: false }), ...objects], { first_hit: { ...defaultFirstHit, enabled: true, observer_body_id: "observer" } }); },
  S09: () => { const scene = makeKouScene("S09"); scene.objects[0]!.world_locked = true; scene.objects[0]!.visible = false; scene.first_hit = { ...defaultFirstHit, enabled: true, observer_body_id: "arena" }; scene.objects.slice(1).forEach((b) => { b.outer_radius = 1.4; b.world_locked = true; }); return scene; },
  S10: () => { const scene = factories.S09!(); scene.scene_id = "S10"; scene.display_name = metadata.find((m) => m.scene_id === "S10")!.display_name; scene.first_hit.mode = "CHRYSANTHEMUM"; return scene; },
  S11: () => makeBase("S11", [body("analytic-source", [0, 0, 0], { world_locked: true, outer_radius: 1 }), body("angular-receiver", [2.4, 0, 0], { world_locked: true, outer_radius: .15 })], { first_hit: { ...defaultFirstHit, enabled: true, observer_body_id: "angular-receiver", direction_count: 4096, mode: "SPHERE_VIEW" } }),
  S12: () => makeKouScene("S12", false),
  S13: () => { const scene = makeKouScene("S13", false, "TINY"); scene.objects.unshift(body("orbit-a", [-.8, 0, 0], { initial_velocity: [0, .25, 0] }), body("orbit-b", [.8, 0, 0], { initial_velocity: [0, -.25, 0] })); return scene; },
  S14: () => { const scene = factories.S13!(); scene.scene_id = "S14"; scene.display_name = metadata.find((m) => m.scene_id === "S14")!.display_name; scene.objects[0]!.transform.position[0] = -.92; scene.objects[1]!.transform.position[0] = .92; return scene; },
  S15: () => { const scene = factories.S13!(); scene.scene_id = "S15"; scene.display_name = metadata.find((m) => m.scene_id === "S15")!.display_name; const first = scene.objects[0]!; first.amount = 1.35; const repacked = generatePacking(first.packing.mode, first.packing.level, first.outer_radius, first.amount, first.packing.custom_count); first.voxel_elements = repacked.elements; first.packing = repacked.definition; return scene; },
  S16: () => makeBase("S16", [body("formed-a", [-1.75, 0, 0], { world_locked: true }), body("formed-b", [1.75, 0, 0], { world_locked: true })]),
  S17: () => makeBase("S17", [body("max-group-a", [-1.2, 0, 0], { group_id: "MAX_GROUP_ALPHA", body_role: "IMPORTED_SOURCE", geometry_type: "IMPORTED_MESH", world_locked: true }), body("max-group-b", [0, 0, 0], { group_id: "MAX_GROUP_BETA", body_role: "IMPORTED_RECEIVER", initial_velocity: [.02, 0, 0] }), body("max-group-c", [1.2, 0, 0], { group_id: "MAX_GROUP_GAMMA", body_role: "IMPORTED_RECEIVER", packing: { ...generatePacking("FCC", "P2", .45, 1).definition, mode: "FCC", level: "P2", display_count: 512, compute_count: 512 } })]),
};

export function loadSceneV2(id: string): SceneDocumentV2 {
  const factory = factories[id] ?? factories.S02!; return structuredClone(factory());
}

export const defaultSceneV2Id = "S02";
