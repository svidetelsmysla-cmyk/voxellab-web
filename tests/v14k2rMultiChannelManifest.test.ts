import { describe, expect, it } from "vitest";
import { REQUIRED_V14K2R_CHANNELS, validateMultiChannelManifest } from "../src/actionLab/equilibriumGpu/multiChannelPacketLoader";

const descriptor = { dtype: "LITTLE_ENDIAN_FLOAT32", shape: [1, 2, 2, 2], byte_length: 32, sha256: "0".repeat(64), relative_path: "x.f32" } as const;

function fixture() {
  const action = (id: string) => ({ channel_id: id, source_class: "DIAGNOSTIC_ACTION_READOUT", closure: id.endsWith("FINITE") ? "FINITE_BOX" : "NEAREST_PERIODIC", normalization: "NONE", claim_ceiling: "NOT_SOURCE_FORCE" });
  const source = (id: string) => ({ channel_id: id, source_class: "SOURCE_PERIODIC_FORCE_BRANCH", closure: "SOURCE_PERIODIC", normalization: "NONE", claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM" });
  return {
    schema: "VOXELLAB_EQUILIBRIUM_MULTI_CHANNEL_PACKET_V1",
    packet_id: "fixture",
    source: { class: "FROZEN", claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM", packet_payload_sha256: "1".repeat(64) },
    grid: { dimensions: [2, 2, 2], origin: [-1, -1, -1], spacing: [1, 1, 1], layout: "X_FASTEST", array_layout: "FRAME_Z_Y_X_COMPONENT", centering: "NODE_CENTERED", periodic_axes: [true, true, true], world_midpoint: [0, 0, 0] },
    times: [40], frames: [{ frame_id: "f0", time: 40, arrays: {} }],
    registered_geometry: { origin: [0, 0, 0], axis_u: [1, 0, 0], axis_v: [0, 1, 0], normal: [0, 0, 1], frozen_before_unblind: true },
    channels: [action(REQUIRED_V14K2R_CHANNELS[0]!), action(REQUIRED_V14K2R_CHANNELS[1]!), ...REQUIRED_V14K2R_CHANNELS.slice(2).map(source)],
    array_blobs: Object.fromEntries(["rho", ...REQUIRED_V14K2R_CHANNELS].map((id) => [id, descriptor])),
    classifier_lock: {}, provenance: {},
  };
}

describe("V14K2R multi-channel manifest firewall", () => {
  it("accepts exactly two action and three source branches", () => {
    expect(() => validateMultiChannelManifest(fixture())).not.toThrow();
  });

  it("rejects W1 promotion to source force", () => {
    const value = fixture();
    value.channels[0]!.claim_ceiling = "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM";
    expect(() => validateMultiChannelManifest(value)).toThrow(/Action channel overclaim/);
  });

  it("rejects channel-specific normalization", () => {
    const value = fixture();
    value.channels[4]!.normalization = "FIT";
    expect(() => validateMultiChannelManifest(value)).toThrow(/semantics mismatch/);
  });
});
