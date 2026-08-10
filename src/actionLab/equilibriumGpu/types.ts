export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export type ClosureMode = "FINITE_BOX" | "NEAREST_PERIODIC";

export type RegimeClass =
  | "RESTORING_ROOT"
  | "SADDLE_INDEX_1"
  | "SADDLE_INDEX_2"
  | "REPELLING_ROOT"
  | "NEUTRAL_DEGENERATE_ROOT"
  | "NONCONSERVATIVE_OR_NUMERICALLY_UNRESOLVED";

export interface ArrayBlobDescriptor {
  dtype: "LITTLE_ENDIAN_FLOAT32";
  shape: number[];
  byte_length: number;
  sha256: string;
  relative_path: string;
}

export interface EquilibriumPacketManifest {
  schema: "VOXELLAB_EQUILIBRIUM_REGIME_PACKET_V1";
  packet_id: string;
  source: { class: string; claim_ceiling: "ACTION_READOUT_NOT_SOURCE_FORCE" };
  grid: {
    dimensions: [number, number, number];
    origin: Vec3;
    spacing: Vec3;
    layout: "X_FASTEST";
    array_layout: "FRAME_Z_Y_X_COMPONENT";
    centering: "NODE_CENTERED";
    periodic_axes: [boolean, boolean, boolean];
    world_midpoint: Vec3;
  };
  times: number[];
  frames: Array<{
    frame_id: string;
    time: number;
    arrays: Record<string, { blob: string; byte_offset: number }>;
  }>;
  registered_geometry: {
    origin: Vec3;
    axis_u: Vec3;
    axis_v: Vec3;
    normal: Vec3;
    frozen_before_unblind: boolean;
  };
  channels: Array<{
    channel_id: string;
    source_class: string;
    closure: ClosureMode;
    normalization: "NONE";
    claim_ceiling: "NOT_SOURCE_FORCE";
  }>;
  array_blobs: Record<"rho" | "finite_response" | "nearest_periodic_response", ArrayBlobDescriptor>;
  provenance: Record<string, string>;
}

export interface LoadedEquilibriumPacket {
  manifest: EquilibriumPacketManifest;
  rho: Float32Array;
  finiteResponse: Float32Array;
  nearestPeriodicResponse: Float32Array;
  verifiedHashes: Record<string, string>;
}

export interface VolumeFrame {
  dimensions: [number, number, number];
  origin: Vec3;
  spacing: Vec3;
  response: Float32Array;
  rho?: Float32Array;
  periodic: boolean;
}

export interface RegimeThresholds {
  rootTolerance: number;
  stiffnessTolerance: number;
  neutralTolerance: number;
  antisymmetryTolerance: number;
}

export interface RegimeSample {
  response: Vec3;
  responseNorm: number;
  jacobian: Mat3;
  stiffnessEigenvalues: Vec3;
  antisymmetryRatio: number;
  regime: RegimeClass;
  isRoot: boolean;
}

export interface QualifiedRoot extends RegimeSample {
  id: string;
  frameIndex: number;
  position: Vec3;
  residualRelative: number;
  branchId?: string;
}

export interface RootBranch {
  id: string;
  closure: ClosureMode;
  roots: QualifiedRoot[];
  persistent: boolean;
}

export interface PlaneDefinition {
  origin: Vec3;
  axisU: Vec3;
  axisV: Vec3;
  extentU: number;
  extentV: number;
}

export interface PlaneResult {
  width: number;
  height: number;
  response: Float32Array;
  eigenvalues: Float32Array;
  antisymmetry: Float32Array;
  classes: Uint32Array;
  backend: "CPU_REFERENCE" | "WEBGPU";
  elapsedMs: number;
}

export const DEFAULT_THRESHOLDS: RegimeThresholds = {
  rootTolerance: 2e-4,
  stiffnessTolerance: 1e-8,
  neutralTolerance: 1e-7,
  antisymmetryTolerance: 5e-2,
};

export const REGIME_IDS: Record<RegimeClass, number> = {
  NONCONSERVATIVE_OR_NUMERICALLY_UNRESOLVED: 0,
  RESTORING_ROOT: 1,
  SADDLE_INDEX_1: 2,
  SADDLE_INDEX_2: 3,
  REPELLING_ROOT: 4,
  NEUTRAL_DEGENERATE_ROOT: 5,
};

export const REGIME_FROM_ID: RegimeClass[] = [
  "NONCONSERVATIVE_OR_NUMERICALLY_UNRESOLVED",
  "RESTORING_ROOT",
  "SADDLE_INDEX_1",
  "SADDLE_INDEX_2",
  "REPELLING_ROOT",
  "NEUTRAL_DEGENERATE_ROOT",
];
