// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { closeSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { join } from "node:path";
import { REQUIRED_V14K2R_CHANNELS, validateMultiChannelManifest } from "../src/actionLab/equilibriumGpu/multiChannelPacketLoader";
import type { MultiChannelManifest, V14K2RChannelId } from "../src/actionLab/equilibriumGpu/multiChannelTypes";
import type { Mat3, QualifiedRoot, Vec3 } from "../src/actionLab/equilibriumGpu/types";

declare const process: { argv: string[] };
function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`);
  return process.argv[index + 1]!;
}
type ChannelCheckpoint = {
  schema: string;
  packet_id: string;
  channel_id: V14K2RChannelId;
  roots_by_frame: QualifiedRoot[][];
  neutral_thresholds: number[];
  branches: Array<{ id: string; persistent: boolean; roots: Array<{ frameIndex: number; regime: string }> }>;
  persistent_branch_count: number;
  persistent_restoring_branch_count: number;
};

const packetDirectory = argument("--packet");
const checkpointDirectory = argument("--checkpoints");
const outputPath = argument("--output");
const raw = JSON.parse(readFileSync(join(packetDirectory, "manifest.json"), "utf8")) as unknown;
validateMultiChannelManifest(raw);
const packet = raw as MultiChannelManifest;
const channels = REQUIRED_V14K2R_CHANNELS.map((channelId) => {
  const path = join(checkpointDirectory, `${channelId}.json`);
  const value = JSON.parse(readFileSync(path, "utf8")) as ChannelCheckpoint;
  if (
    value.schema !== "V14K2R_SINGLE_CHANNEL_ROOT_TIMELINE_CHECKPOINT_V1"
    || value.packet_id !== packet.packet_id
    || value.channel_id !== channelId
    || value.roots_by_frame.length !== packet.frames.length
  ) throw new Error(`invalid checkpoint ${channelId}`);
  return value;
});
const byChannel = Object.fromEntries(channels.map((item) => [item.channel_id, item])) as Record<V14K2RChannelId, ChannelCheckpoint>;
const [nx, ny, nz] = packet.grid.dimensions;
const scalarFrameBytes = nx * ny * nz * 4;
const rhoDescriptor = packet.array_blobs.rho;
const wrap = (value: number, n: number) => ((value % n) + n) % n;
const periodicDistance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((value, axis) => {
  const delta = Math.abs(value - b[axis]!);
  return Math.min(delta, packet.grid.dimensions[axis]! * packet.grid.spacing[axis]! - delta);
}) as [number, number, number]);
const persistentIds = (result: ChannelCheckpoint) =>
  new Set(result.branches.filter((branch) => branch.persistent).map((branch) => branch.id));

function stiffnessEigenvectors(jacobian: Mat3): Mat3 {
  const matrix: Mat3 = [
    [-jacobian[0][0], -0.5 * (jacobian[0][1] + jacobian[1][0]), -0.5 * (jacobian[0][2] + jacobian[2][0])],
    [-0.5 * (jacobian[1][0] + jacobian[0][1]), -jacobian[1][1], -0.5 * (jacobian[1][2] + jacobian[2][1])],
    [-0.5 * (jacobian[2][0] + jacobian[0][2]), -0.5 * (jacobian[2][1] + jacobian[1][2]), -jacobian[2][2]],
  ];
  const vectors: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 32; sweep++) {
    let p = 0, q = 1, largest = Math.abs(matrix[0][1]);
    for (const [row, col] of [[0, 2], [1, 2]] as const) {
      const magnitude = Math.abs(matrix[row][col]);
      if (magnitude > largest) { largest = magnitude; p = row; q = col; }
    }
    if (largest <= 1e-15 * Math.max(1, Math.abs(matrix[0][0]), Math.abs(matrix[1][1]), Math.abs(matrix[2][2]))) break;
    const angle = 0.5 * Math.atan2(2 * matrix[p][q], matrix[q][q] - matrix[p][p]);
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const app = matrix[p][p], aqq = matrix[q][q], apq = matrix[p][q];
    matrix[p][p] = cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    matrix[q][q] = sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    matrix[p][q] = matrix[q][p] = 0;
    for (let index = 0; index < 3; index++) {
      if (index !== p && index !== q) {
        const aip = matrix[index][p], aiq = matrix[index][q];
        matrix[index][p] = matrix[p][index] = cosine * aip - sine * aiq;
        matrix[index][q] = matrix[q][index] = sine * aip + cosine * aiq;
      }
      const vip = vectors[index][p], viq = vectors[index][q];
      vectors[index][p] = cosine * vip - sine * viq;
      vectors[index][q] = sine * vip + cosine * viq;
    }
  }
  const order = [0, 1, 2].sort((left, right) => matrix[left][left] - matrix[right][right]);
  return order.map((column) => [vectors[0][column], vectors[1][column], vectors[2][column]]) as Mat3;
}

const channelsWithEigenvectors = channels.map((channel) => ({
  ...channel,
  roots_by_frame: channel.roots_by_frame.map((roots) => roots.map((root) => ({
    ...root,
    stiffnessEigenvectors: stiffnessEigenvectors(root.jacobian),
  }))),
  root_record_fields: [
    "position", "response", "responseNorm", "jacobian", "stiffnessEigenvalues",
    "stiffnessEigenvectors", "antisymmetryRatio", "regime", "residualRelative", "branchId",
  ],
}));

const actionW1 = byChannel.ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC;
const sourceAction = byChannel.SOURCE_ACTION_FORCE_PERIODIC;
const sourceTotal = byChannel.SOURCE_TOTAL_FORCE_PERIODIC;
const actionPersistent = persistentIds(actionW1);
const sourceActionPersistent = persistentIds(sourceAction);
const sourceTotalPersistent = persistentIds(sourceTotal);
const g11Rows: Array<Record<string, unknown>> = [];
for (let frameIndex = 0; frameIndex < packet.frames.length; frameIndex++) {
  for (const root of actionW1.roots_by_frame[frameIndex]!) {
    const nearest = (roots: QualifiedRoot[]) => roots.length
      ? roots.map((candidate) => ({ candidate, distance: periodicDistance(root.position, candidate.position) }))
        .sort((a, b) => a.distance - b.distance)[0]!
      : undefined;
    const toAction = nearest(sourceAction.roots_by_frame[frameIndex]!);
    const toTotal = nearest(sourceTotal.roots_by_frame[frameIndex]!);
    g11Rows.push({
      frame_index: frameIndex,
      time: packet.times[frameIndex],
      w1_root_id: root.id,
      w1_regime: root.regime,
      w1_persistent: actionPersistent.has(root.branchId ?? ""),
      source_action_distance: toAction?.distance ?? null,
      source_action_regime_agreement: toAction ? toAction.candidate.regime === root.regime : null,
      source_action_persistence_agreement: toAction
        ? actionPersistent.has(root.branchId ?? "") === sourceActionPersistent.has(toAction.candidate.branchId ?? "")
        : null,
      source_total_distance: toTotal?.distance ?? null,
      source_total_regime_agreement: toTotal ? toTotal.candidate.regime === root.regime : null,
      source_total_persistence_agreement: toTotal
        ? actionPersistent.has(root.branchId ?? "") === sourceTotalPersistent.has(toTotal.candidate.branchId ?? "")
        : null,
    });
  }
}

function readRho(frameIndex: number) {
  const fd = openSync(join(packetDirectory, rhoDescriptor.relative_path), "r");
  try {
    const bytes = new Uint8Array(scalarFrameBytes);
    const count = readSync(fd, bytes, 0, scalarFrameBytes, frameIndex * scalarFrameBytes);
    if (count !== scalarFrameBytes) throw new Error(`short rho frame ${frameIndex}`);
    return new Float32Array(bytes.buffer);
  } finally {
    closeSync(fd);
  }
}
function densityCentres(frameIndex: number) {
  const rho = readRho(frameIndex);
  const scalarIndex = (x: number, y: number, z: number) =>
    (wrap(z, nz) * ny + wrap(y, ny)) * nx + wrap(x, nx);
  const candidates: Array<{ index: number; value: number; position: Vec3 }> = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const index = scalarIndex(x, y, z);
    const value = rho[index]!;
    let strict = true;
    for (let dz = -1; dz <= 1 && strict; dz++) for (let dy = -1; dy <= 1 && strict; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      if (value <= rho[scalarIndex(x + dx, y + dy, z + dz)]!) { strict = false; break; }
    }
    if (strict) candidates.push({
      index,
      value,
      position: [
        packet.grid.origin[0] + x * packet.grid.spacing[0],
        packet.grid.origin[1] + y * packet.grid.spacing[1],
        packet.grid.origin[2] + z * packet.grid.spacing[2],
      ],
    });
  }
  candidates.sort((a, b) => b.value - a.value || a.index - b.index);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.every((other) => periodicDistance(candidate.position, other.position) >= 2 * Math.min(...packet.grid.spacing))) selected.push(candidate);
    if (selected.length === 8) break;
  }
  return selected;
}
const densityByFrame = packet.frames.map((_, frameIndex) => densityCentres(frameIndex));
const g12Steps: Array<Record<string, unknown>> = [];
for (const branch of sourceTotal.branches.filter((item) => item.persistent)) {
  const roots = branch.roots
    .map((item) => sourceTotal.roots_by_frame[item.frameIndex]!.find((root) => root.branchId === branch.id && root.regime === item.regime))
    .filter((root): root is QualifiedRoot => Boolean(root))
    .filter((root) => root.regime === "RESTORING_ROOT");
  for (let index = 0; index + 1 < roots.length; index++) {
    const current = roots[index]!, next = roots[index + 1]!;
    if (next.frameIndex !== current.frameIndex + 1) continue;
    const nearestDistance = (root: QualifiedRoot) =>
      Math.min(...densityByFrame[root.frameIndex]!.map((centre) => periodicDistance(root.position, centre.position)));
    const before = nearestDistance(current), after = nearestDistance(next);
    g12Steps.push({ branch_id: branch.id, frame_index: current.frameIndex, distance_before: before, distance_after: after, delta: after - before });
  }
}
const deltas = g12Steps.map((row) => row.delta as number).sort((a, b) => a - b);
const median = deltas.length ? deltas[Math.floor((deltas.length - 1) / 2)]! : null;
const decreaseFraction = deltas.length ? deltas.filter((value) => value < 0).length / deltas.length : null;
const g12Status = deltas.length < 2 ? "UNRESOLVED" : median! < 0 && decreaseFraction! > 0.5 ? "PASS" : "FAIL";

const output = {
  schema: "V14K2R_FULL_MULTI_CHANNEL_ROOT_TIMELINE_V1",
  packet_id: packet.packet_id,
  source_packet_payload_sha256: packet.source.packet_payload_sha256,
  classifier: "SHARED_PUBLISHED_COMPONENT_SIGN_BRACKET_TRILINEAR_NEWTON_FULL_JACOBIAN",
  neutral_node_specialization: "EXACT_PARITY_CENTERED_DIFFERENCE_AT_GRID_NODES",
  density_used_for_root_candidates_or_branch_matching: false,
  channel_execution: "INDEPENDENT_CHECKPOINTS_ASSEMBLED_WITHOUT_ALGORITHM_CHANGE",
  channels: channelsWithEigenvectors,
  g11r_d_action_scaffold_crosswalk: g11Rows,
  g12_density_following: {
    detector: "TOP8_STRICT_PERIODIC_26_NEIGHBOUR_MAXIMA_NO_THRESHOLD",
    steps: g12Steps,
    median_step_delta: median,
    decrease_fraction: decreaseFraction,
    status: g12Status,
  },
  claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
};
writeFileSync(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({
  status: "V14K2R_FULL_ROOT_TIMELINE_BUILT",
  persistent: Object.fromEntries(channels.map((item) => [item.channel_id, item.persistent_branch_count])),
  persistent_restoring: Object.fromEntries(channels.map((item) => [item.channel_id, item.persistent_restoring_branch_count])),
  g11_rows: g11Rows.length,
  g12_steps: g12Steps.length,
  g12: g12Status,
}, null, 2));
