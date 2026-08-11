// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { closeSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { join } from "node:path";
import {
  DEFAULT_THRESHOLDS,
  type Mat3,
  type QualifiedRoot,
  type Vec3,
  type VolumeFrame,
} from "../src/actionLab/equilibriumGpu/types";
import {
  findQualifiedRoots,
  stiffnessFromJacobian,
  symmetricEigenvalues,
} from "../src/actionLab/equilibriumGpu/cpuReference";
import { trackRootBranches } from "../src/actionLab/equilibriumGpu/branchTracker";
import { validateMultiChannelManifest } from "../src/actionLab/equilibriumGpu/multiChannelPacketLoader";
import type {
  MultiChannelManifest,
  V14K2RChannelId,
} from "../src/actionLab/equilibriumGpu/multiChannelTypes";

declare const process: { argv: string[] };

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing ${name}`);
  return process.argv[index + 1]!;
}

const packetDirectory = argument("--packet");
const outputPath = argument("--output");
const manifest = JSON.parse(readFileSync(join(packetDirectory, "manifest.json"), "utf8")) as unknown;
validateMultiChannelManifest(manifest);
const packet = manifest as MultiChannelManifest;
const [nx, ny, nz] = packet.grid.dimensions;
const voxelCount = nx * ny * nz;
const vectorFrameBytes = voxelCount * 3 * 4;
const scalarFrameBytes = voxelCount * 4;

function readFloat32Frame(path: string, frameIndex: number, byteLength: number) {
  const descriptor = packet.array_blobs[path as keyof typeof packet.array_blobs];
  if (!descriptor) throw new Error(`missing blob ${path}`);
  const fd = openSync(join(packetDirectory, descriptor.relative_path), "r");
  try {
    const bytes = new Uint8Array(byteLength);
    const count = readSync(fd, bytes, 0, byteLength, frameIndex * byteLength);
    if (count !== byteLength) throw new Error(`short frame read ${path} frame ${frameIndex}`);
    return new Float32Array(bytes.buffer);
  } finally {
    closeSync(fd);
  }
}

function frame(channelId: V14K2RChannelId, frameIndex: number): VolumeFrame {
  const channel = packet.channels.find((item) => item.channel_id === channelId)!;
  return {
    dimensions: packet.grid.dimensions,
    origin: packet.grid.origin,
    spacing: packet.grid.spacing,
    response: readFloat32Frame(channelId, frameIndex, vectorFrameBytes),
    periodic: channel.closure !== "FINITE_BOX",
  };
}

const wrap = (value: number, n: number) => ((value % n) + n) % n;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const nodeIndex = (x: number, y: number, z: number) => ((z * ny + y) * nx + x) * 3;

/** Exact node specialization of the published centered-difference classifier. */
function exactFastNeutralTolerance(volume: VolumeFrame) {
  const values = new Float64Array(voxelCount * 3);
  let cursor = 0;
  const index = (x: number, y: number, z: number) => nodeIndex(
    volume.periodic ? wrap(x, nx) : clamp(x, 0, nx - 1),
    volume.periodic ? wrap(y, ny) : clamp(y, 0, ny - 1),
    volume.periodic ? wrap(z, nz) : clamp(z, 0, nz - 1),
  );
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const columns: number[][] = [];
    for (let axis = 0; axis < 3; axis++) {
      const plus = index(x + (axis === 0 ? 1 : 0), y + (axis === 1 ? 1 : 0), z + (axis === 2 ? 1 : 0));
      const minus = index(x - (axis === 0 ? 1 : 0), y - (axis === 1 ? 1 : 0), z - (axis === 2 ? 1 : 0));
      const denominator = 2 * volume.spacing[axis]!;
      columns.push([0, 1, 2].map((component) => (volume.response[plus + component]! - volume.response[minus + component]!) / denominator));
    }
    const jacobian: Mat3 = [
      [columns[0]![0]!, columns[1]![0]!, columns[2]![0]!],
      [columns[0]![1]!, columns[1]![1]!, columns[2]![1]!],
      [columns[0]![2]!, columns[1]![2]!, columns[2]![2]!],
    ];
    const eigenvalues = symmetricEigenvalues(stiffnessFromJacobian(jacobian).stiffness);
    values[cursor++] = Math.abs(eigenvalues[0]);
    values[cursor++] = Math.abs(eigenvalues[1]);
    values[cursor++] = Math.abs(eigenvalues[2]);
  }
  values.sort();
  return Math.max(1e-6, 1e-3 * values[Math.floor(0.95 * (values.length - 1))]!);
}

function compact(root: QualifiedRoot) {
  return {
    id: root.id, frameIndex: root.frameIndex, position: root.position,
    stiffnessEigenvalues: root.stiffnessEigenvalues,
    antisymmetryRatio: root.antisymmetryRatio, regime: root.regime,
    residualRelative: root.residualRelative, branchId: root.branchId,
  };
}

const channelResults = packet.channels.map((channel) => {
  const rootsByFrame: QualifiedRoot[][] = [];
  const neutralThresholds: number[] = [];
  for (let frameIndex = 0; frameIndex < packet.frames.length; frameIndex++) {
    const volume = frame(channel.channel_id, frameIndex);
    const neutralTolerance = exactFastNeutralTolerance(volume);
    neutralThresholds.push(neutralTolerance);
    rootsByFrame.push(findQualifiedRoots(volume, frameIndex, 2e-4, { ...DEFAULT_THRESHOLDS, neutralTolerance }));
    console.log(`roots channel=${channel.channel_id} frame=${frameIndex + 1}/${packet.frames.length}`);
  }
  const closure = channel.closure === "FINITE_BOX" ? "FINITE_BOX" : "NEAREST_PERIODIC";
  const branches = trackRootBranches(rootsByFrame, closure);
  const prefix = channel.channel_id.split("_").map((word) => word[0]).join("");
  for (const branch of branches) {
    const original = branch.id;
    branch.id = `${prefix}-${original}`;
    for (const root of branch.roots) root.branchId = branch.id;
  }
  return {
    channel_id: channel.channel_id,
    roots_by_frame: rootsByFrame,
    neutral_thresholds: neutralThresholds,
    branches,
    persistent_branch_count: branches.filter((branch) => branch.persistent).length,
    persistent_restoring_branch_count: branches.filter((branch) => branch.persistent && branch.roots.some((root) => root.regime === "RESTORING_ROOT")).length,
  };
});

const byChannel = Object.fromEntries(channelResults.map((item) => [item.channel_id, item]));
const periodicDistance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((value, axis) => {
  const delta = Math.abs(value - b[axis]!);
  return Math.min(delta, packet.grid.dimensions[axis]! * packet.grid.spacing[axis]! - delta);
}) as [number, number, number]);

const actionW1 = byChannel.ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC!;
const sourceAction = byChannel.SOURCE_ACTION_FORCE_PERIODIC!;
const sourceTotal = byChannel.SOURCE_TOTAL_FORCE_PERIODIC!;
const persistentIds = (result: typeof actionW1) => new Set(result.branches.filter((branch) => branch.persistent).map((branch) => branch.id));
const actionPersistent = persistentIds(actionW1), sourceActionPersistent = persistentIds(sourceAction), sourceTotalPersistent = persistentIds(sourceTotal);
const g11Rows: Array<Record<string, unknown>> = [];
for (let frameIndex = 0; frameIndex < packet.frames.length; frameIndex++) {
  for (const root of actionW1.roots_by_frame[frameIndex]!) {
    const nearest = (roots: QualifiedRoot[]) => roots.length
      ? roots.map((candidate) => ({ candidate, distance: periodicDistance(root.position, candidate.position) })).sort((a, b) => a.distance - b.distance)[0]!
      : undefined;
    const toAction = nearest(sourceAction.roots_by_frame[frameIndex]!);
    const toTotal = nearest(sourceTotal.roots_by_frame[frameIndex]!);
    g11Rows.push({
      frame_index: frameIndex, time: packet.times[frameIndex], w1_root_id: root.id,
      w1_regime: root.regime, w1_persistent: actionPersistent.has(root.branchId ?? ""),
      source_action_distance: toAction?.distance ?? null,
      source_action_regime_agreement: toAction ? toAction.candidate.regime === root.regime : null,
      source_action_persistence_agreement: toAction ? actionPersistent.has(root.branchId ?? "") === sourceActionPersistent.has(toAction.candidate.branchId ?? "") : null,
      source_total_distance: toTotal?.distance ?? null,
      source_total_regime_agreement: toTotal ? toTotal.candidate.regime === root.regime : null,
      source_total_persistence_agreement: toTotal ? actionPersistent.has(root.branchId ?? "") === sourceTotalPersistent.has(toTotal.candidate.branchId ?? "") : null,
    });
  }
}

function densityCentres(frameIndex: number) {
  const rho = readFloat32Frame("rho", frameIndex, scalarFrameBytes);
  const scalarIndex = (x: number, y: number, z: number) => (wrap(z, nz) * ny + wrap(y, ny)) * nx + wrap(x, nx);
  const candidates: Array<{ index: number; value: number; position: Vec3 }> = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const index = scalarIndex(x, y, z), value = rho[index]!;
    let strict = true;
    for (let dz = -1; dz <= 1 && strict; dz++) for (let dy = -1; dy <= 1 && strict; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      if (value <= rho[scalarIndex(x + dx, y + dy, z + dz)]!) { strict = false; break; }
    }
    if (strict) candidates.push({
      index, value,
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
  const restoring = branch.roots.filter((root) => root.regime === "RESTORING_ROOT");
  for (let index = 0; index + 1 < restoring.length; index++) {
    const current = restoring[index]!, next = restoring[index + 1]!;
    if (next.frameIndex !== current.frameIndex + 1) continue;
    const nearestDistance = (root: QualifiedRoot) => Math.min(...densityByFrame[root.frameIndex]!.map((centre) => periodicDistance(root.position, centre.position)));
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
  channels: channelResults.map((item) => ({
    channel_id: item.channel_id,
    roots_by_frame: item.roots_by_frame.map((roots) => roots.map(compact)),
    neutral_thresholds: item.neutral_thresholds,
    branches: item.branches.map((branch) => ({ id: branch.id, persistent: branch.persistent, roots: branch.roots.map((root) => ({ frameIndex: root.frameIndex, regime: root.regime })) })),
    persistent_branch_count: item.persistent_branch_count,
    persistent_restoring_branch_count: item.persistent_restoring_branch_count,
  })),
  g11r_d_action_scaffold_crosswalk: g11Rows,
  g12_density_following: {
    detector: "TOP8_STRICT_PERIODIC_26_NEIGHBOUR_MAXIMA_NO_THRESHOLD",
    steps: g12Steps, median_step_delta: median, decrease_fraction: decreaseFraction, status: g12Status,
  },
  claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  status: "V14K2R_FULL_ROOT_TIMELINE_BUILT",
  persistent: Object.fromEntries(channelResults.map((item) => [item.channel_id, item.persistent_branch_count])),
  persistent_restoring: Object.fromEntries(channelResults.map((item) => [item.channel_id, item.persistent_restoring_branch_count])),
  g12: g12Status,
}, null, 2));
