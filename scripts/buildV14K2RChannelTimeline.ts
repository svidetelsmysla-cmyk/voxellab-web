// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { closeSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { join } from "node:path";
import { DEFAULT_THRESHOLDS, type QualifiedRoot, type VolumeFrame } from "../src/actionLab/equilibriumGpu/types";
import { findQualifiedRoots } from "../src/actionLab/equilibriumGpu/cpuReference";
import { trackRootBranches } from "../src/actionLab/equilibriumGpu/branchTracker";
import { exactGridNodeNeutralTolerance } from "../src/actionLab/equilibriumGpu/fastNeutralTolerance";
import { REQUIRED_V14K2R_CHANNELS, validateMultiChannelManifest } from "../src/actionLab/equilibriumGpu/multiChannelPacketLoader";
import type { MultiChannelManifest, V14K2RChannelId } from "../src/actionLab/equilibriumGpu/multiChannelTypes";

declare const process: { argv: string[] };
function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`);
  return process.argv[index + 1]!;
}

const packetDirectory = argument("--packet");
const channelId = argument("--channel") as V14K2RChannelId;
const outputPath = argument("--output");
if (!REQUIRED_V14K2R_CHANNELS.includes(channelId)) throw new Error(`unsupported channel ${channelId}`);
const raw = JSON.parse(readFileSync(join(packetDirectory, "manifest.json"), "utf8")) as unknown;
validateMultiChannelManifest(raw);
const packet = raw as MultiChannelManifest;
const [nx, ny, nz] = packet.grid.dimensions;
const vectorFrameBytes = nx * ny * nz * 3 * 4;
const descriptor = packet.array_blobs[channelId];
const channel = packet.channels.find((item) => item.channel_id === channelId)!;

function frame(frameIndex: number): VolumeFrame {
  const fd = openSync(join(packetDirectory, descriptor.relative_path), "r");
  try {
    const bytes = new Uint8Array(vectorFrameBytes);
    const count = readSync(fd, bytes, 0, vectorFrameBytes, frameIndex * vectorFrameBytes);
    if (count !== vectorFrameBytes) throw new Error(`short frame read ${channelId} ${frameIndex}`);
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

const rootsByFrame: QualifiedRoot[][] = [];
const neutralThresholds: number[] = [];
for (let frameIndex = 0; frameIndex < packet.frames.length; frameIndex++) {
  const volume = frame(frameIndex);
  const neutralTolerance = exactGridNodeNeutralTolerance(volume);
  neutralThresholds.push(neutralTolerance);
  rootsByFrame.push(findQualifiedRoots(
    volume,
    frameIndex,
    2e-4,
    { ...DEFAULT_THRESHOLDS, neutralTolerance },
  ));
  console.log(`roots channel=${channelId} frame=${frameIndex + 1}/${packet.frames.length}`);
}
const closure = channel.closure === "FINITE_BOX" ? "FINITE_BOX" : "NEAREST_PERIODIC";
const branches = trackRootBranches(rootsByFrame, closure);
const prefix = channelId.split("_").map((word) => word[0]).join("");
for (const branch of branches) {
  const original = branch.id;
  branch.id = `${prefix}-${original}`;
  for (const root of branch.roots) root.branchId = branch.id;
}

const output = {
  schema: "V14K2R_SINGLE_CHANNEL_ROOT_TIMELINE_CHECKPOINT_V1",
  packet_id: packet.packet_id,
  channel_id: channelId,
  classifier: "SHARED_PUBLISHED_COMPONENT_SIGN_BRACKET_TRILINEAR_NEWTON_FULL_JACOBIAN",
  neutral_node_specialization: "EXACT_PARITY_CENTERED_DIFFERENCE_AT_GRID_NODES",
  roots_by_frame: rootsByFrame,
  neutral_thresholds: neutralThresholds,
  branches: branches.map((branch) => ({
    id: branch.id,
    persistent: branch.persistent,
    roots: branch.roots.map((root) => ({ frameIndex: root.frameIndex, regime: root.regime })),
  })),
  persistent_branch_count: branches.filter((branch) => branch.persistent).length,
  persistent_restoring_branch_count: branches.filter(
    (branch) => branch.persistent && branch.roots.some((root) => root.regime === "RESTORING_ROOT")
  ).length,
  root_record_fields: [
    "position", "response", "responseNorm", "jacobian", "stiffnessEigenvalues",
    "antisymmetryRatio", "regime", "residualRelative", "branchId",
  ],
  density_used_for_root_candidates_or_branch_matching: false,
  claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
};
writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({
  status: "V14K2R_CHANNEL_TIMELINE_BUILT",
  channel_id: channelId,
  roots: rootsByFrame.reduce((sum, roots) => sum + roots.length, 0),
  persistent: output.persistent_branch_count,
  persistent_restoring: output.persistent_restoring_branch_count,
}, null, 2));
