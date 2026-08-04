export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type RepresentationMode = "CM_CONTROL" | "RIGID_VOLUME";

export interface Transform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

export interface VoxelElement {
  local_position: Vec3;
  amount: number;
  volume: number;
}

export interface Provenance {
  source: string;
  producer_commit: string;
  claim_ceiling: string;
}

export interface SceneObject {
  object_id: string;
  group_id: string;
  parent_id: string | null;
  display_name: string;
  body_role: string;
  representation_mode: RepresentationMode;
  transform: Transform;
  geometry_type: "SPHERE" | "VOXEL_GROUP";
  outer_radius: number;
  amount: number;
  density: number;
  k_v: number;
  world_locked: boolean;
  movable_translation: boolean;
  movable_rotation: boolean;
  fixed_far: boolean;
  visible: boolean;
  voxel_level: "CM" | "V0" | "V1" | "V2";
  voxel_elements: VoxelElement[];
  provenance: Provenance;
}

export interface SceneDocument {
  scene_version: "1.0";
  scene_id: string;
  display_name: string;
  description: string;
  does_not_claim: string;
  coefficient_c: number;
  objects: SceneObject[];
  provenance: Provenance;
}

export interface BodyResult {
  object_id: string;
  force: Vec3;
  torque: Vec3;
}

export interface ComputeResult {
  backend: "CPU_WORKER" | "CPU_DIRECT" | "WEBGPU";
  bodies: BodyResult[];
  amount_in: number;
  amount_out: number;
  amount_residual: number;
  compute_ms: number;
}

export interface BrowserPacket {
  packet_version: "1.0";
  producer_commit: string;
  packet_sha256: string;
  manifest_sha256: string;
  verdict: string;
  claim_ceiling: string;
  scene: unknown;
  body_transforms: number[][][];
  body_forces: number[][];
  body_torques: number[][];
  amount_ledger: number[];
  diagnostics: Record<string, unknown>;
  visual_arrays: Record<string, unknown>;
}

export interface WebGpuStatus {
  secureContext: boolean;
  navigatorGpu: boolean;
  adapter: boolean;
  device: boolean;
  limits: Record<string, number>;
  parity: "PASS" | "FAIL" | "NOT_AVAILABLE" | "PENDING";
  detail: string;
}
