import { describe, expect, it } from "vitest";
import {
  classifyAt,
  deriveFrameNeutralTolerance,
  findQualifiedRoots,
  responseJacobian,
  sampleResponse,
  symmetricEigenvalues,
} from "../src/actionLab/equilibriumGpu/cpuReference";
import type { Mat3, Vec3, VolumeFrame } from "../src/actionLab/equilibriumGpu/types";

function linearVolume(j: Mat3, offset: Vec3 = [0, 0, 0], n = 7): VolumeFrame {
  const origin: Vec3 = [-3, -3, -3];
  const response = new Float32Array(n ** 3 * 3);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const p: Vec3 = [origin[0] + x - offset[0], origin[1] + y - offset[1], origin[2] + z - offset[2]];
    const i = ((z * n + y) * n + x) * 3;
    for (let row = 0; row < 3; row++) response[i + row] = j[row]![0] * p[0] + j[row]![1] * p[1] + j[row]![2] * p[2];
  }
  return { dimensions: [n, n, n], origin, spacing: [1, 1, 1], response, periodic: false };
}

describe("WebGPU equilibrium float64/TypeScript method oracle", () => {
  it("samples the registered X-fastest vector volume and recovers a full 3x3 Jacobian", () => {
    const j: Mat3 = [[-2, 0.25, 0], [0.25, -1, 0], [0, 0, -0.5]];
    const frame = linearVolume(j);
    expect(sampleResponse(frame, [0.25, -0.5, 0.75])).toEqual([-0.625, 0.5625, -0.375]);
    const recovered = responseJacobian(frame, [0, 0, 0]);
    recovered.forEach((row, i) => row.forEach((value, k) => expect(value).toBeCloseTo(j[i]![k]!, 12)));
  });

  it("classifies restoring, divergent, both saddle indices and neutral from full 3D K", () => {
    const cases: Array<[Mat3, string]> = [
      [[[-1, 0, 0], [0, -1, 0], [0, 0, -1]], "RESTORING_ROOT"],
      [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], "REPELLING_ROOT"],
      [[[1, 0, 0], [0, -1, 0], [0, 0, -1]], "SADDLE_INDEX_1"],
      [[[-1, 0, 0], [0, 1, 0], [0, 0, 1]], "SADDLE_INDEX_2"],
      [[[-1, 0, 0], [0, -1, 0], [0, 0, 0]], "NEUTRAL_DEGENERATE_ROOT"],
    ];
    cases.forEach(([j, expected]) => expect(classifyAt(linearVolume(j), [0, 0, 0]).regime).toBe(expected));
  });

  it("rejects the hidden-direction falsifier: a 2D well that is a 3D saddle", () => {
    const sample = classifyAt(linearVolume([[-1, 0, 0], [0, -1, 0], [0, 0, 1]]), [0, 0, 0]);
    expect(sample.stiffnessEigenvalues).toEqual([-1, 1, 1]);
    expect(sample.regime).toBe("SADDLE_INDEX_1");
  });

  it("finds and refines an off-node root without consulting density", () => {
    const root: Vec3 = [0.35, -0.4, 0.2];
    const frame = linearVolume([[-1, 0, 0], [0, -2, 0], [0, 0, -3]], root);
    frame.rho = new Float32Array(frame.dimensions[0] ** 3).map((_, i) => i % 11);
    const roots = findQualifiedRoots(frame, 4);
    expect(roots).toHaveLength(1);
    roots[0]!.position.forEach((value, axis) => expect(value).toBeCloseTo(root[axis]!, 5));
    expect(roots[0]!.regime).toBe("RESTORING_ROOT");
  });

  it("returns stable sorted eigenvalues for a rotated symmetric matrix", () => {
    const values = symmetricEigenvalues([[2, 1, 0], [1, 2, 0], [0, 0, -4]]);
    expect(values[0]).toBeCloseTo(-4, 12);
    expect(values[1]).toBeCloseTo(1, 12);
    expect(values[2]).toBeCloseTo(3, 12);
  });

  it("applies the preregistered frame-relative neutral threshold without density", () => {
    const frame = linearVolume([[-1, 0, 0], [0, -2, 0], [0, 0, -3]]);
    frame.rho = new Float32Array(frame.response.length / 3).fill(999);
    expect(deriveFrameNeutralTolerance(frame)).toBeCloseTo(0.003, 12);
  });
});
