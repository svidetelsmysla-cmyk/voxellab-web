import { describe, expect, it } from "vitest";
import manifest from "../public/packets/webgpu-equilibrium-regime-map-v1/manifest.json";
import { classifyRegimeShader } from "../src/actionLab/equilibriumGpu/shaders/classifyRegime.wgsl";
import { frameVolume } from "../src/actionLab/equilibriumGpu/packetLoader";
import type { LoadedEquilibriumPacket } from "../src/actionLab/equilibriumGpu/types";

describe("immutable P1 equilibrium packet and production shader contract", () => {
  it("locks schema, frame alignment, binary sizes and scientific ceiling", () => {
    expect(manifest.schema).toBe("VOXELLAB_EQUILIBRIUM_REGIME_PACKET_V1");
    expect(manifest.source.claim_ceiling).toBe("ACTION_READOUT_NOT_SOURCE_FORCE");
    expect(manifest.frames).toHaveLength(36);
    expect(manifest.times).toHaveLength(36);
    expect(manifest.grid.dimensions).toEqual([16, 16, 16]);
    expect(manifest.grid.layout).toBe("X_FASTEST");
    expect(manifest.array_blobs.rho.byte_length).toBe(36 * 16 ** 3 * 4);
    expect(manifest.array_blobs.finite_response.byte_length).toBe(36 * 16 ** 3 * 3 * 4);
    expect(manifest.array_blobs.nearest_periodic_response.byte_length).toBe(36 * 16 ** 3 * 3 * 4);
    expect(manifest.channels.map((channel) => channel.closure)).toEqual(["FINITE_BOX", "NEAREST_PERIODIC"]);
  });

  it("keeps finite and nearest-periodic channels separate and unnormalized", () => {
    expect(manifest.channels.every((channel) => channel.normalization === "NONE")).toBe(true);
    expect(manifest.array_blobs.finite_response.sha256).not.toBe(manifest.array_blobs.nearest_periodic_response.sha256);
  });

  it("contains a real f32 WebGPU compute pipeline with full 3D derivatives and no f16", () => {
    expect(classifyRegimeShader).toContain("@compute");
    expect(classifyRegimeShader).toContain("sample_response(point + vec3f(0,0,h.z))");
    expect(classifyRegimeShader).toContain("transpose(j)");
    expect(classifyRegimeShader).not.toContain("f16");
    expect(classifyRegimeShader).not.toContain("complex");
  });

  it("slices rho and response from the identical frame without a material lag", () => {
    const voxels = 16 ** 3;
    const rho = new Float32Array(2 * voxels); rho.fill(1, 0, voxels); rho.fill(2, voxels);
    const finite = new Float32Array(2 * voxels * 3); finite.fill(10, 0, voxels * 3); finite.fill(20, voxels * 3);
    const periodic = new Float32Array(finite);
    const packet = {
      manifest: { ...manifest, times: manifest.times.slice(0, 2), frames: manifest.frames.slice(0, 2) },
      rho, finiteResponse: finite, nearestPeriodicResponse: periodic, verifiedHashes: {},
    } as unknown as LoadedEquilibriumPacket;
    const selected = frameVolume(packet, 1, "FINITE_BOX");
    expect(selected.rho![0]).toBe(2);
    expect(selected.response[0]).toBe(20);
    expect(selected.rho).toHaveLength(voxels);
    expect(selected.response).toHaveLength(voxels * 3);
  });
});
