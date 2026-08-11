// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { closeSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { join } from "node:path";
import { exactGridNodeNeutralTolerance } from "../src/actionLab/equilibriumGpu/fastNeutralTolerance";
import { validateMultiChannelManifest } from "../src/actionLab/equilibriumGpu/multiChannelPacketLoader";
import type {
  MultiChannelManifest,
  V14K2RChannelId,
} from "../src/actionLab/equilibriumGpu/multiChannelTypes";
import type { VolumeFrame } from "../src/actionLab/equilibriumGpu/types";

declare const process: { argv: string[] };

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`);
  return process.argv[index + 1]!;
}

const packetDirectory = argument("--packet");
const outputPath = argument("--output");
const raw = JSON.parse(readFileSync(join(packetDirectory, "manifest.json"), "utf8")) as unknown;
validateMultiChannelManifest(raw);
const packet = raw as MultiChannelManifest;
const [nx, ny, nz] = packet.grid.dimensions;
const vectorFrameBytes = nx * ny * nz * 3 * 4;

function frame(channelId: V14K2RChannelId, frameIndex: number): VolumeFrame {
  const descriptor = packet.array_blobs[channelId];
  const fd = openSync(join(packetDirectory, descriptor.relative_path), "r");
  try {
    const bytes = new Uint8Array(vectorFrameBytes);
    const count = readSync(fd, bytes, 0, vectorFrameBytes, frameIndex * vectorFrameBytes);
    if (count !== vectorFrameBytes) throw new Error(`short frame read ${channelId} ${frameIndex}`);
    const channel = packet.channels.find((item) => item.channel_id === channelId)!;
    return {
      dimensions: packet.grid.dimensions,
      origin: packet.grid.origin,
      spacing: packet.grid.spacing,
      response: new Float32Array(bytes.buffer),
      periodic: channel.closure !== "FINITE_BOX",
    };
  } finally {
    closeSync(fd);
  }
}

const channels = packet.channels.map((channel) => ({
  channel_id: channel.channel_id,
  neutral_thresholds: packet.frames.map((_, frameIndex) =>
    exactGridNodeNeutralTolerance(frame(channel.channel_id, frameIndex))
  ),
  roots_by_frame: packet.frames.map(() => []),
  persistent_branch_count: 0,
  roots_omitted_from_public_json: true,
}));

const output = {
  schema: "V14K2R_PUBLIC_MULTI_CHANNEL_NEUTRAL_TIMELINE_V1",
  packet_id: packet.packet_id,
  source_packet_payload_sha256: packet.source.packet_payload_sha256,
  frames: packet.frames.map((item) => ({
    frame_id: item.frame_id,
    time: item.time,
    full_packet_frame_index: (item as typeof item & { full_packet_frame_index?: number })
      .full_packet_frame_index,
  })),
  channels,
  classifier: "SHARED_EXACT_GRID_NODE_NEUTRAL_TOLERANCE",
  browser_behavior: "ROOTS_RECOMPUTED_FROM_HASH_VERIFIED_54_CUBED_VECTOR_FIELD",
  roots_omitted_reason: "AVOID_MULTI_GIGABYTE_DERIVED_JSON_WITHOUT_REMOVING_SOURCE_FIELDS",
  claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  status: "V14K2R_PUBLIC_NEUTRAL_TIMELINE_BUILT",
  frames: packet.frames.length,
  channels: channels.length,
}, null, 2));
