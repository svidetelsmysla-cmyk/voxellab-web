import type { ArrayBlobDescriptor, Vec3, VolumeFrame } from "./types";

export type V14K2RChannelId =
  | "ACTION_K2_STATE_MINUS_REFERENCE_W1_FINITE"
  | "ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC"
  | "SOURCE_MATERIAL_FORCE_PERIODIC"
  | "SOURCE_ACTION_FORCE_PERIODIC"
  | "SOURCE_TOTAL_FORCE_PERIODIC";

export type MultiChannelClosure = "FINITE_BOX" | "NEAREST_PERIODIC" | "SOURCE_PERIODIC";

export interface MultiChannelManifest {
  schema: "VOXELLAB_EQUILIBRIUM_MULTI_CHANNEL_PACKET_V1";
  packet_id: string;
  source: { class: string; claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM"; packet_payload_sha256: string };
  grid: {
    dimensions: [number, number, number]; origin: Vec3; spacing: Vec3;
    layout: "X_FASTEST"; array_layout: "FRAME_Z_Y_X_COMPONENT";
    centering: "NODE_CENTERED"; periodic_axes: [boolean, boolean, boolean]; world_midpoint: Vec3;
  };
  times: number[];
  frames: Array<{ frame_id: string; time: number; arrays: Record<string, { blob: string; byte_offset: number }> }>;
  registered_geometry: { origin: Vec3; axis_u: Vec3; axis_v: Vec3; normal: Vec3; frozen_before_unblind: boolean };
  channels: Array<{
    channel_id: V14K2RChannelId; source_class: string; closure: MultiChannelClosure;
    normalization: "NONE"; claim_ceiling: "NOT_SOURCE_FORCE" | "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM";
  }>;
  array_blobs: Record<"rho" | V14K2RChannelId, ArrayBlobDescriptor>;
  classifier_lock: Record<string, unknown>;
  provenance: Record<string, string>;
}

export interface LoadedMultiChannelPacket {
  manifest: MultiChannelManifest;
  rho: Float32Array;
  responses: Record<V14K2RChannelId, Float32Array>;
  verifiedHashes: Record<string, string>;
}

export interface MultiChannelTimeline {
  schema: "V14K2R_MULTI_CHANNEL_ROOT_TIMELINE_V1";
  packet_id: string;
  channels: Array<{
    channel_id: V14K2RChannelId;
    roots_by_frame: Array<Array<{
      id: string; frameIndex: number; position: Vec3; stiffnessEigenvalues: Vec3;
      antisymmetryRatio: number; regime: string; residualRelative: number; branchId?: string;
    }>>;
    neutral_thresholds: number[];
    persistent_branch_count: number;
  }>;
}

export type MultiChannelVolume = VolumeFrame;
