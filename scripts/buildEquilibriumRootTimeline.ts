// @ts-expect-error Node built-ins are supplied by the governed build runtime.
import { readFileSync, writeFileSync } from "node:fs";
import { deriveFrameNeutralTolerance, findQualifiedRoots } from "../src/actionLab/equilibriumGpu/cpuReference";
import { trackRootBranches } from "../src/actionLab/equilibriumGpu/branchTracker";
import { frameVolume } from "../src/actionLab/equilibriumGpu/packetLoader";
import { DEFAULT_THRESHOLDS, type ClosureMode, type EquilibriumPacketManifest, type LoadedEquilibriumPacket } from "../src/actionLab/equilibriumGpu/types";

const packetDirectory = new URL("../public/packets/webgpu-equilibrium-regime-map-v1/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", packetDirectory), "utf8")) as EquilibriumPacketManifest;
const readFloat32 = (name: string) => {
  const bytes = readFileSync(new URL(name, packetDirectory));
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
};
const packet: LoadedEquilibriumPacket = {
  manifest,
  rho: readFloat32("rho.f32"),
  finiteResponse: readFloat32("finite_response.f32"),
  nearestPeriodicResponse: readFloat32("nearest_periodic_response.f32"),
  verifiedHashes: {},
};
const closures: ClosureMode[] = ["FINITE_BOX", "NEAREST_PERIODIC"];
const output = closures.map((closure) => {
  const volumes = manifest.frames.map((_, frameIndex) => frameVolume(packet, frameIndex, closure));
  const neutralThresholds = volumes.map(deriveFrameNeutralTolerance);
  const rootsByFrame = volumes.map((volume, frameIndex) => findQualifiedRoots(volume, frameIndex, 2e-4, { ...DEFAULT_THRESHOLDS, neutralTolerance: neutralThresholds[frameIndex]! }));
  const branches = trackRootBranches(rootsByFrame, closure);
  const compactRoot = (root: typeof rootsByFrame[number][number]) => ({
    id: root.id,
    frameIndex: root.frameIndex,
    position: root.position,
    stiffnessEigenvalues: root.stiffnessEigenvalues,
    antisymmetryRatio: root.antisymmetryRatio,
    regime: root.regime,
    residualRelative: root.residualRelative,
    branchId: root.branchId,
  });
  return {
    closure,
    roots_by_frame: rootsByFrame.map((roots) => roots.map(compactRoot)),
    neutral_thresholds: neutralThresholds,
    branches: branches.map((branch) => ({
      id: branch.id,
      closure: branch.closure,
      persistent: branch.persistent,
      roots: branch.roots.map((root) => ({ frameIndex: root.frameIndex })),
    })),
    persistent_branch_count: branches.filter((branch) => branch.persistent).length,
  };
});
const receipt = {
  schema: "VOXELLAB_EQUILIBRIUM_ROOT_TIMELINE_V1",
  packet_id: manifest.packet_id,
  source_packet_sha256: manifest.provenance.source_packet_sha256,
  algorithm: "3D_COMPONENT_SIGN_BRACKET_TRILINEAR_NEWTON_FULL_JACOBIAN_GLOBAL_ASSIGNMENT",
  density_used_for_candidates_or_matching: false,
  relative_root_tolerance: 2e-4,
  neutral_rule: "MAX_1E_6_OR_1E_3_FRAME_KAPPA_P95",
  persistence_frames: 2,
  claim_ceiling: "ACTION_READOUT_NOT_SOURCE_FORCE",
  closures: output,
};
writeFileSync(new URL("root_timeline.json", packetDirectory), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({
  status: "ROOT_TIMELINE_BUILD_PASS",
  counts: Object.fromEntries(output.map((item) => [item.closure, item.roots_by_frame.map((roots) => roots.length)])),
  persistent: Object.fromEntries(output.map((item) => [item.closure, item.persistent_branch_count])),
}, null, 2));
