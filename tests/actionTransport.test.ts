import { describe, expect, it } from "vitest";
import {
  analyticSphereOutside,
  createVolumeCubature,
  curvedSolidAngleSphere,
  distributedVolumeSphere,
  raySphereInterval,
  relativeError,
  rendererCapImportanceSphere,
  sphereVolume,
  vectorNorm,
  type SphereModel,
  type Vec3,
} from "../src/actionLab/math";

const model: SphereModel = { radius: 1, density: 1 };

describe("Action Transport Lab A0 sphere fixture", () => {
  it("locks the analytic exterior resultant to the exact 1/r^2 formed-body law", () => {
    for (const distance of [1.05, 1.2, 2, 5, 8]) {
      const sample = analyticSphereOutside([distance, 0, 0], model);
      const expected = sphereVolume(model) / distance ** 2;
      expect(relativeError(sample.w1Magnitude, expected)).toBeLessThan(1e-13);
      expect(sample.w1[0]).toBeLessThan(0);
      expect(Math.abs(sample.w1[1])).toBeLessThan(1e-14);
      expect(Math.abs(sample.w1[2])).toBeLessThan(1e-14);
    }
  });

  it("keeps curved H(Omega) and renderer-style cap sampling on the analytic oracle", () => {
    for (const distance of [1.05, 1.2, 2, 5, 8]) {
      const probe: Vec3 = [distance, 0, 0];
      const oracle = analyticSphereOutside(probe, model);
      const curved = curvedSolidAngleSphere(probe, model, 96);
      const renderer = rendererCapImportanceSphere(probe, model, 2048);
      expect(relativeError(curved.w0, oracle.w0)).toBeLessThan(2e-5);
      expect(relativeError(curved.w1Magnitude, oracle.w1Magnitude)).toBeLessThan(2e-5);
      expect(relativeError(renderer.w0, oracle.w0)).toBeLessThan(2e-4);
      expect(relativeError(renderer.w1Magnitude, oracle.w1Magnitude)).toBeLessThan(2e-4);
      expect(renderer.hitCount).toBe(renderer.sampleCount);
    }
  });

  it("keeps the equal-volume small-body route within the frozen A0 corridor", () => {
    const cubature = createVolumeCubature(model, 16, 1024);
    for (const distance of [1.05, 1.2, 1.5, 2, 5, 8]) {
      const probe: Vec3 = [distance, 0, 0];
      const oracle = analyticSphereOutside(probe, model);
      const volume = distributedVolumeSphere(probe, model, cubature);
      expect(relativeError(volume.w0, oracle.w0)).toBeLessThan(2e-3);
      expect(relativeError(volume.w1Magnitude, oracle.w1Magnitude)).toBeLessThan(2e-3);
    }
  });

  it("preserves frame covariance for an arbitrarily oriented exterior probe", () => {
    const axis = 1 / Math.sqrt(3);
    const probe: Vec3 = [2 * axis, 2 * axis, 2 * axis];
    const oracle = analyticSphereOutside(probe, model);
    const curved = curvedSolidAngleSphere(probe, model, 96);
    const renderer = rendererCapImportanceSphere(probe, model, 2048);
    const expectedDirection: Vec3 = [-axis, -axis, -axis];
    const normalizedOracle: Vec3 = [
      oracle.w1[0] / oracle.w1Magnitude,
      oracle.w1[1] / oracle.w1Magnitude,
      oracle.w1[2] / oracle.w1Magnitude,
    ];
    expect(vectorNorm([
      normalizedOracle[0] - expectedDirection[0],
      normalizedOracle[1] - expectedDirection[1],
      normalizedOracle[2] - expectedDirection[2],
    ])).toBeLessThan(1e-13);
    expect(relativeError(curved.w1Magnitude, oracle.w1Magnitude)).toBeLessThan(2e-5);
    expect(relativeError(renderer.w1Magnitude, oracle.w1Magnitude)).toBeLessThan(2e-4);
  });

  it("returns the exact positive chord for a ray through the sphere", () => {
    const interval = raySphereInterval([2, 0, 0], [-1, 0, 0], 1);
    expect(interval).not.toBeNull();
    expect(interval?.[0]).toBeCloseTo(1, 14);
    expect(interval?.[1]).toBeCloseTo(3, 14);
    expect(raySphereInterval([2, 0, 0], [1, 0, 0], 1)).toBeNull();
  });
});
