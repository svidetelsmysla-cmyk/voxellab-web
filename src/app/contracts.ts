export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type PackingMode = "SC" | "BCC" | "FCC" | "HCP" | "IMPORTED_POINTS";
export type PackingLevel = "P0" | "P1" | "P2" | "P3" | "P4";
export type KouRole = "ARENA" | "MOVABLE_BUFFER" | "GUARD_CONTOUR" | "FAR_EXTERNAL_CONTOUR" | "NUMERICAL_EDGE_DIAGNOSTIC";
export type SceneStatus = "ENGINEERING_RUN_PASS" | "ENGINEERING_RUN_BLOCKED" | "PREVIEW_RESULT_RECORDED" | "PACKET_ONLY" | "SETUP_ONLY";

export interface Transform { position: Vec3; rotation: Quat; scale: Vec3 }
export interface Provenance { source: string; producer_commit: string; claim_ceiling: string }
export interface VoxelElement { local_position: Vec3; amount: number; volume: number }

export interface BodyIdentity {
  object_id: string;
  group_id: string;
  parent_id: string | null;
  display_name: string;
  body_role: string;
}

export interface PackingDefinition {
  mode: PackingMode;
  level: PackingLevel;
  custom_count: number | null;
  display_count: number;
  compute_count: number;
  boundary_policy: "SPHERE_CLIP_RECENTER_RENORMALIZE" | "IMPORTED_POINTS";
}

export interface RigidGroup extends BodyIdentity {
  representation_mode: "CM_CONTROL" | "RIGID_VOLUME";
  transform: Transform;
  geometry_type: "SPHERE" | "VOXEL_GROUP" | "IMPORTED_MESH";
  outer_radius: number;
  amount: number;
  density: number;
  k_v: number;
  world_locked: boolean;
  movable_translation: boolean;
  movable_rotation: boolean;
  initial_velocity: Vec3;
  initial_angular_velocity: Vec3;
  velocity: Vec3;
  angular_velocity: Vec3;
  fixed_far: boolean;
  visible: boolean;
  kou_tier: number | null;
  kou_role: KouRole | null;
  packing: PackingDefinition;
  voxel_level: "CM" | "V0" | "V1" | "V2" | "V3" | "V4";
  voxel_elements: VoxelElement[];
  provenance: Provenance;
}

export interface KouDefinition {
  enabled: boolean;
  preset: "TINY" | "M0_K4" | "M0_K6" | "CUSTOM";
  m: number;
  tiers: number;
  tier_spacing: number;
  body_amount: number;
  body_radius: number;
  near_movable_tiers: number;
  guard_tiers: number;
  far_fixed_tiers: number;
  orientation_seed: number;
  all_movable: boolean;
  hidden_tiers: number[];
}

export interface SimulationSettings {
  dt: number;
  substeps_per_frame: number;
  playback_speed: number;
  fps_cap: 15 | 30 | 60 | 0;
  damping_enabled: boolean;
  damping_factor: number;
  integrator: "SYMPLECTIC_EULER";
  operator_name: "CM_CONTROL" | "POINT_CUBATURE_SC" | "POINT_CUBATURE_BCC" | "POINT_CUBATURE_FCC" | "POINT_CUBATURE_HCP" | "POINT_CUBATURE_IMPORTED";
  evaluation_method: "EXACT_UNIFORM_SPHERE_EXTERIOR_REDUCTION" | "DISTRIBUTED_ELEMENTS";
}

export interface FirstHitSettings {
  enabled: boolean;
  observer_body_id: string | null;
  direction_count: number;
  max_distance: number;
  mode: "SKY_VIEW" | "SPHERE_VIEW" | "CHRYSANTHEMUM" | "RAYS";
}

export interface SceneDocumentV2 {
  scene_version: "2.0";
  scene_id: string;
  scene_class: "DYNAMIC" | "CONTROL" | "DIAGNOSTIC" | "PACKET_ONLY" | "SETUP_ONLY";
  category: string;
  display_name: string;
  description: string;
  mobility_summary: string;
  does_not_claim: string;
  coefficient_c: number;
  objects: RigidGroup[];
  simulation: SimulationSettings;
  first_hit: FirstHitSettings;
  kou: KouDefinition | null;
  provenance: Provenance;
}

export interface BodyResult { object_id: string; force: Vec3; torque: Vec3 }
export interface ComputeResult {
  backend: "CPU_WORKER" | "CPU_DIRECT" | "WEBGPU";
  evaluation_method?: SimulationSettings["evaluation_method"];
  bodies: BodyResult[];
  amount_in: number;
  amount_out: number;
  amount_residual: number;
  action_reaction_residual?: number;
  compute_ms: number;
}

export interface FirstHitResult {
  direction_count: number;
  coverage_fraction: number;
  uncovered_solid_angle: number;
  largest_angular_hole: number;
  largest_hole_direction: Vec3;
  maximum_first_hit_distance: number | null;
  distances: number[];
  body_ids: (string | null)[];
  directions: Vec3[];
}

export interface SceneRunReceipt {
  scene_id: string;
  scene_class: SceneDocumentV2["scene_class"];
  commit: string;
  backend: string;
  operator_name: SimulationSettings["operator_name"];
  evaluation_method: SimulationSettings["evaluation_method"];
  body_count: number;
  movable_body_count: number;
  locked_body_count: number;
  compute_element_count: number;
  display_element_count: number;
  packing: string[];
  kou_tier_counts: number[];
  first_hit_direction_count: number;
  steps_run: number;
  runtime_seconds: number;
  mean_compute_ms: number;
  p95_compute_ms: number;
  mean_fps: number;
  amount_residual: number;
  momentum_residual: number;
  action_reaction_residual: number;
  coverage_fraction: number | null;
  largest_hole: number | null;
  maximum_first_hit_distance: number | null;
  final_motion_class: string;
  claim_ceiling: string;
  status: SceneStatus;
  failure_reason: string | null;
}

export interface BrowserPacketV2 {
  packet_version: "2.0";
  producer_commit: string;
  packet_sha256: string;
  manifest_sha256: string;
  verdict: string;
  claim_ceiling: string;
  scene: unknown;
  receipts: SceneRunReceipt[];
  diagnostics: Record<string, unknown>;
  visual_arrays: Record<string, unknown>;
}
