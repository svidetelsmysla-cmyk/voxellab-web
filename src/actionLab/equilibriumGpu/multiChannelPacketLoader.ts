import { sha256Hex } from "./packetLoader";
import type { ArrayBlobDescriptor } from "./types";
import type {
  LoadedMultiChannelPacket,
  MultiChannelManifest,
  V14K2RChannelId,
} from "./multiChannelTypes";

export const REQUIRED_V14K2R_CHANNELS: V14K2RChannelId[] = [
  "ACTION_K2_STATE_MINUS_REFERENCE_W1_FINITE",
  "ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC",
  "SOURCE_MATERIAL_FORCE_PERIODIC",
  "SOURCE_ACTION_FORCE_PERIODIC",
  "SOURCE_TOTAL_FORCE_PERIODIC",
];

export function validateMultiChannelManifest(value: unknown): asserts value is MultiChannelManifest {
  const manifest = value as Partial<MultiChannelManifest>;
  if (manifest.schema !== "VOXELLAB_EQUILIBRIUM_MULTI_CHANNEL_PACKET_V1") throw new Error("Unsupported V14K2R packet schema");
  if (manifest.source?.claim_ceiling !== "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM") throw new Error("V14K2R claim ceiling mismatch");
  if (manifest.grid?.layout !== "X_FASTEST" || manifest.grid.array_layout !== "FRAME_Z_Y_X_COMPONENT") throw new Error("Unsupported V14K2R volume layout");
  if (!manifest.frames?.length || manifest.frames.length !== manifest.times?.length) throw new Error("V14K2R frame/time mismatch");
  if (!manifest.registered_geometry?.frozen_before_unblind) throw new Error("V14K2R registered geometry is not frozen");
  const channels = manifest.channels ?? [];
  if (channels.length !== REQUIRED_V14K2R_CHANNELS.length) throw new Error("V14K2R channel count mismatch");
  for (const id of REQUIRED_V14K2R_CHANNELS) {
    const channel = channels.find((item) => item.channel_id === id);
    if (!channel || channel.normalization !== "NONE") throw new Error(`V14K2R channel semantics mismatch: ${id}`);
    const action = id.startsWith("ACTION_");
    if (action && channel.claim_ceiling !== "NOT_SOURCE_FORCE") throw new Error(`Action channel overclaim: ${id}`);
    if (!action && channel.claim_ceiling !== "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM") throw new Error(`Source channel ceiling mismatch: ${id}`);
  }
}

async function fetchVerifiedFloat32(baseUrl: string, descriptor: ArrayBlobDescriptor) {
  const response = await fetch(`${baseUrl}/${descriptor.relative_path}`);
  if (!response.ok) throw new Error(`V14K2R blob fetch failed: ${descriptor.relative_path}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== descriptor.byte_length) throw new Error(`V14K2R blob length mismatch: ${descriptor.relative_path}`);
  const digest = await sha256Hex(bytes);
  if (digest !== descriptor.sha256) throw new Error(`V14K2R blob hash mismatch: ${descriptor.relative_path}`);
  return { values: new Float32Array(bytes), digest };
}

export async function loadMultiChannelPacket(baseUrl: string): Promise<LoadedMultiChannelPacket> {
  const response = await fetch(`${baseUrl}/manifest.json`);
  if (!response.ok) throw new Error("V14K2R manifest fetch failed");
  const manifest = await response.json() as unknown;
  validateMultiChannelManifest(manifest);
  const rho = await fetchVerifiedFloat32(baseUrl, manifest.array_blobs.rho);
  const responsePairs = await Promise.all(REQUIRED_V14K2R_CHANNELS.map(async (id) => [id, await fetchVerifiedFloat32(baseUrl, manifest.array_blobs[id])] as const));
  const voxels = manifest.grid.dimensions.reduce((a, b) => a * b, 1);
  if (rho.values.length !== manifest.frames.length * voxels) throw new Error("V14K2R rho length mismatch");
  if (rho.values.some((value) => value < 0 || !Number.isFinite(value))) throw new Error("V14K2R rho must be finite and nonnegative");
  const responses = {} as Record<V14K2RChannelId, Float32Array>;
  const verifiedHashes: Record<string, string> = { rho: rho.digest };
  for (const [id, blob] of responsePairs) {
    if (blob.values.length !== manifest.frames.length * voxels * 3 || blob.values.some((value) => !Number.isFinite(value))) throw new Error(`V14K2R vector length/value mismatch: ${id}`);
    responses[id] = blob.values; verifiedHashes[id] = blob.digest;
  }
  return { manifest, rho: rho.values, responses, verifiedHashes };
}

export function multiChannelFrameVolume(packet: LoadedMultiChannelPacket, frameIndex: number, channelId: V14K2RChannelId) {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= packet.manifest.frames.length) throw new RangeError("V14K2R frame outside timeline");
  const voxels = packet.manifest.grid.dimensions.reduce((a, b) => a * b, 1);
  const response = packet.responses[channelId];
  const closure = packet.manifest.channels.find((item) => item.channel_id === channelId)?.closure;
  return {
    dimensions: [...packet.manifest.grid.dimensions] as [number, number, number],
    origin: packet.manifest.grid.origin,
    spacing: packet.manifest.grid.spacing,
    response: response.subarray(frameIndex * voxels * 3, (frameIndex + 1) * voxels * 3),
    rho: packet.rho.subarray(frameIndex * voxels, (frameIndex + 1) * voxels),
    periodic: closure !== "FINITE_BOX",
  };
}
