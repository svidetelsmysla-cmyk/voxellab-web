import { describe, expect, it } from "vitest";
import { deriveFrameNeutralTolerance } from "../src/actionLab/equilibriumGpu/cpuReference";
import { exactGridNodeNeutralTolerance } from "../src/actionLab/equilibriumGpu/fastNeutralTolerance";
import type { VolumeFrame } from "../src/actionLab/equilibriumGpu/types";

function fixture(periodic: boolean): VolumeFrame {
  const dimensions: [number, number, number] = [4, 5, 6];
  const values = new Float32Array(dimensions[0] * dimensions[1] * dimensions[2] * 3);
  for (let index = 0; index < values.length; index++) values[index] = Math.sin(index * 0.37) + 0.2 * Math.cos(index * 0.11);
  return { dimensions, origin: [-2, -2.5, -3], spacing: [1, 1, 1], response: values, periodic };
}

describe("V14K2R fast neutral threshold parity", () => {
  for (const periodic of [false, true]) it(`matches published node classifier (periodic=${periodic})`, () => {
    const frame = fixture(periodic);
    expect(exactGridNodeNeutralTolerance(frame)).toBeCloseTo(deriveFrameNeutralTolerance(frame), 14);
  });
});
