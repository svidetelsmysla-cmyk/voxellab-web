import type { RigidGroup, SceneDocumentV2, Vec3 } from "../app/contracts";
import { generatePacking } from "../packing/generatePacking";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);

export class SceneValidationError extends Error { constructor(public readonly issues: string[]) { super(issues.join("; ")); } }

export function migrateSceneV1(value: RecordValue): SceneDocumentV2 {
  const sourceObjects = Array.isArray(value.objects) ? value.objects.filter(record) : [];
  const objects: RigidGroup[] = sourceObjects.map((source, index) => {
    const transform = record(source.transform) ? source.transform : {};
    const amount = Number(source.amount ?? 1); const density = Number(source.density ?? 1); const radius = Number(source.outer_radius ?? .4);
    const legacy = Array.isArray(source.voxel_elements) ? source.voxel_elements as RigidGroup["voxel_elements"] : generatePacking("FCC", "P1", radius, amount).elements;
    return {
      object_id: String(source.object_id ?? `legacy-${index}`), group_id: String(source.group_id ?? "legacy"), parent_id: source.parent_id === null ? null : String(source.parent_id ?? "") || null,
      display_name: String(source.display_name ?? `Legacy body ${index + 1}`), body_role: String(source.body_role ?? "LEGACY_BODY"),
      representation_mode: source.representation_mode === "CM_CONTROL" ? "CM_CONTROL" : "RIGID_VOLUME",
      transform: { position: (transform.position ?? [0,0,0]) as Vec3, rotation: (transform.rotation ?? [0,0,0,1]) as RigidGroup["transform"]["rotation"], scale: (transform.scale ?? [1,1,1]) as Vec3 },
      geometry_type: source.geometry_type === "SPHERE" ? "SPHERE" : "VOXEL_GROUP", outer_radius: radius, amount, density, k_v: Number(source.k_v ?? 1),
      world_locked: Boolean(source.world_locked), movable_translation: Boolean(source.movable_translation), movable_rotation: Boolean(source.movable_rotation),
      initial_velocity: [0,0,0], initial_angular_velocity: [0,0,0], velocity: [0,0,0], angular_velocity: [0,0,0], fixed_far: Boolean(source.fixed_far), visible: source.visible !== false,
      kou_tier: null, kou_role: null, packing: { mode: "IMPORTED_POINTS", level: "P4", custom_count: legacy.length, display_count: legacy.length, compute_count: legacy.length, boundary_policy: "IMPORTED_POINTS" },
      voxel_level: "V1", voxel_elements: legacy,
      provenance: record(source.provenance) ? source.provenance as unknown as RigidGroup["provenance"] : { source: "scene v1 migration", producer_commit: "LEGACY", claim_ceiling: "PREVIEW_ONLY" },
    };
  });
  return {
    scene_version: "2.0", scene_id: String(value.scene_id ?? "IMPORTED_V1"), scene_class: "DIAGNOSTIC", category: "Imported v1", display_name: String(value.display_name ?? "Imported scene v1"),
    description: String(value.description ?? "Migrated scene schema v1"), mobility_summary: "preserved v1 lock flags", does_not_claim: String(value.does_not_claim ?? "scientific authority"), coefficient_c: Number(value.coefficient_c ?? 1), objects,
    simulation: { dt: .002, substeps_per_frame: 4, playback_speed: 1, fps_cap: 60, damping_enabled: false, damping_factor: .997, integrator: "SYMPLECTIC_EULER", operator_name: "POINT_CUBATURE_IMPORTED", evaluation_method: "DISTRIBUTED_ELEMENTS" },
    first_hit: { enabled: false, observer_body_id: null, direction_count: 16384, max_distance: 20, mode: "SKY_VIEW" }, kou: null,
    provenance: record(value.provenance) ? value.provenance as unknown as SceneDocumentV2["provenance"] : { source: "scene v1 migration", producer_commit: "LEGACY", claim_ceiling: "PREVIEW_ONLY" },
  };
}

export function parseSceneV2(value: unknown): SceneDocumentV2 {
  if (!record(value)) throw new SceneValidationError(["scene: object required"]);
  if (value.scene_version === "1.0") return migrateSceneV1(value);
  const issues: string[] = [];
  if (value.scene_version !== "2.0") issues.push("scene_version: expected 2.0 or importable 1.0");
  if (!Array.isArray(value.objects) || value.objects.length === 0) issues.push("objects: non-empty array required");
  else value.objects.forEach((item, i) => {
    if (!record(item)) issues.push(`objects[${i}]: object required`);
    else {
      if (!Array.isArray(item.initial_velocity) || item.initial_velocity.length !== 3) issues.push(`objects[${i}].initial_velocity: vec3 required`);
      if (!record(item.packing)) issues.push(`objects[${i}].packing: required`);
      const amount = Number(item.amount); const ledger = Array.isArray(item.voxel_elements) ? item.voxel_elements.reduce((sum, e) => sum + (record(e) ? Number(e.amount) : 0), 0) : NaN;
      if (!Number.isFinite(ledger) || Math.abs(amount - ledger) > 1e-9) issues.push(`objects[${i}].amount: positive-element ledger mismatch`);
    }
  });
  if (!record(value.simulation) || value.simulation.damping_enabled === undefined || typeof value.simulation.operator_name !== "string") issues.push("simulation: explicit damping state and operator_name required");
  if (issues.length) throw new SceneValidationError(issues);
  return structuredClone(value) as unknown as SceneDocumentV2;
}

export const serializeSceneV2 = (scene: SceneDocumentV2): string => `${JSON.stringify(scene, null, 2)}\n`;
