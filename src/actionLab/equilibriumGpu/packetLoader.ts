import type {
  ClosureMode,
  EquilibriumPacketManifest,
  ArrayBlobDescriptor,
  LoadedEquilibriumPacket,
  VolumeFrame,
} from "./types";

const FRAME_SCALARS = 16 * 16 * 16;
const FRAME_VECTORS = FRAME_SCALARS * 3;

export function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

function assertManifest(value: unknown): asserts value is EquilibriumPacketManifest {
  const m = value as Partial<EquilibriumPacketManifest>;
  if (m.schema !== "VOXELLAB_EQUILIBRIUM_REGIME_PACKET_V1") throw new Error("Unsupported equilibrium packet schema");
  if (m.source?.claim_ceiling !== "ACTION_READOUT_NOT_SOURCE_FORCE") throw new Error("Claim ceiling mismatch");
  if (m.grid?.layout !== "X_FASTEST" || m.grid.array_layout !== "FRAME_Z_Y_X_COMPONENT") {
    throw new Error("Unsupported response-volume layout");
  }
  if (m.frames?.length !== m.times?.length || !m.frames?.length) throw new Error("Frame/time alignment mismatch");
  if (!m.registered_geometry?.frozen_before_unblind) throw new Error("Registered geometry is not frozen");
  if (m.channels?.some((channel) => channel.normalization !== "NONE" || channel.claim_ceiling !== "NOT_SOURCE_FORCE")) {
    throw new Error("Channel semantics mismatch");
  }
}

async function fetchVerifiedFloat32(baseUrl: string, descriptor: ArrayBlobDescriptor) {
  const response = await fetch(`${baseUrl}/${descriptor.relative_path}`);
  if (!response.ok) throw new Error(`Packet blob fetch failed: ${descriptor.relative_path}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== descriptor.byte_length) throw new Error(`Packet blob length mismatch: ${descriptor.relative_path}`);
  const digest = await sha256Hex(bytes);
  if (digest !== descriptor.sha256) throw new Error(`Packet blob hash mismatch: ${descriptor.relative_path}`);
  return { values: new Float32Array(bytes), digest };
}

export async function loadEquilibriumPacket(baseUrl: string): Promise<LoadedEquilibriumPacket> {
  const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
  if (!manifestResponse.ok) throw new Error("Equilibrium manifest fetch failed");
  const manifest = (await manifestResponse.json()) as unknown;
  assertManifest(manifest);
  const [rho, finite, periodic] = await Promise.all([
    fetchVerifiedFloat32(baseUrl, manifest.array_blobs.rho),
    fetchVerifiedFloat32(baseUrl, manifest.array_blobs.finite_response),
    fetchVerifiedFloat32(baseUrl, manifest.array_blobs.nearest_periodic_response),
  ]);
  const voxelCount = manifest.grid.dimensions.reduce((a, b) => a * b, 1);
  if (voxelCount !== FRAME_SCALARS || finite.values.length !== manifest.frames.length * FRAME_VECTORS) {
    throw new Error("Frozen P1 dimensions do not match declared volume");
  }
  if (rho.values.some((value) => value < 0 || !Number.isFinite(value))) throw new Error("rho must be finite and nonnegative");
  return {
    manifest,
    rho: rho.values,
    finiteResponse: finite.values,
    nearestPeriodicResponse: periodic.values,
    verifiedHashes: { rho: rho.digest, finite_response: finite.digest, nearest_periodic_response: periodic.digest },
  };
}

export function frameVolume(packet: LoadedEquilibriumPacket, frameIndex: number, closure: ClosureMode): VolumeFrame {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= packet.manifest.frames.length) {
    throw new RangeError("Frame index outside packet timeline");
  }
  const voxels = packet.manifest.grid.dimensions.reduce((a, b) => a * b, 1);
  const responseSource = closure === "FINITE_BOX" ? packet.finiteResponse : packet.nearestPeriodicResponse;
  return {
    dimensions: [...packet.manifest.grid.dimensions],
    origin: packet.manifest.grid.origin,
    spacing: packet.manifest.grid.spacing,
    response: responseSource.subarray(frameIndex * voxels * 3, (frameIndex + 1) * voxels * 3),
    rho: packet.rho.subarray(frameIndex * voxels, (frameIndex + 1) * voxels),
    periodic: closure === "NEAREST_PERIODIC",
  };
}
