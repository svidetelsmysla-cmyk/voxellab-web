import type { KouDefinition, KouRole, RigidGroup, Vec3 } from "../app/contracts";
import { generatePacking } from "../packing/generatePacking";

export const KOU_PRESETS = {
  TINY: { m: 1, tiers: 3, count: 28 },
  M0_K4: { m: 3, tiers: 4, count: 180 },
  M0_K6: { m: 3, tiers: 6, count: 546 },
} as const;

function roleForTier(tier: number, definition: KouDefinition): KouRole {
  if (tier <= definition.near_movable_tiers) return "MOVABLE_BUFFER";
  if (tier <= definition.near_movable_tiers + definition.guard_tiers) return "GUARD_CONTOUR";
  if (tier <= definition.tiers - definition.far_fixed_tiers) return "NUMERICAL_EDGE_DIAGNOSTIC";
  return "FAR_EXTERNAL_CONTOUR";
}

export function expectedKouCount(m: number, tiers: number): number {
  let count = 0;
  for (let k = 1; k <= tiers; k += 1) count += 2 * m * k * k;
  return count;
}

export function generateKou(definition: KouDefinition): RigidGroup[] {
  const bodies: RigidGroup[] = [];
  for (let k = 1; k <= definition.tiers; k += 1) {
    const pairs = definition.m * k * k;
    const role = roleForTier(k, definition);
    const radius = definition.tier_spacing * (k + 1);
    for (let a = 0; a < pairs; a += 1) {
      const z = (a + 0.5) / pairs;
      const polar = Math.sqrt(Math.max(0, 1 - z * z));
      const azimuth = (a + definition.orientation_seed * 0.001) * Math.PI * (3 - Math.sqrt(5));
      const direction: Vec3 = [polar * Math.cos(azimuth), polar * Math.sin(azimuth), z];
      for (let sign = 1; sign >= -1; sign -= 2) {
        const index = bodies.length;
        const packing = generatePacking("SC", "P0", definition.body_radius, definition.body_amount);
        const locked = definition.all_movable ? false : role === "FAR_EXTERNAL_CONTOUR";
        bodies.push({
          object_id: `kou-k${k}-${index}`, group_id: `kou-tier-${k}`, parent_id: null,
          display_name: `KOU tier ${k} body ${index + 1}`, body_role: role,
          representation_mode: "RIGID_VOLUME", geometry_type: "SPHERE",
          transform: { position: [sign * radius * direction[0], sign * radius * direction[1], sign * radius * direction[2]], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
          outer_radius: definition.body_radius, amount: definition.body_amount, density: 1, k_v: 1,
          world_locked: locked, movable_translation: !locked, movable_rotation: !locked,
          initial_velocity: [0, 0, 0], initial_angular_velocity: [0, 0, 0], velocity: [0, 0, 0], angular_velocity: [0, 0, 0],
          fixed_far: locked, visible: !definition.hidden_tiers.includes(k), kou_tier: k, kou_role: role,
          packing: { ...packing.definition, display_count: 1, compute_count: 1 }, voxel_level: "V0",
          voxel_elements: [{ local_position: [0, 0, 0], amount: definition.body_amount, volume: definition.body_amount }],
          provenance: { source: "browser exact antipodal KOU generator", producer_commit: "LOCAL_BUILD", claim_ceiling: "GEOMETRY_PREVIEW_NOT_VALIDATION" },
        });
      }
    }
  }
  return bodies;
}

