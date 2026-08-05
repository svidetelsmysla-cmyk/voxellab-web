import { describe, expect, it } from "vitest";
import {
  analyticIsotropicSphereBackground,
  backgroundRelativeError,
  curvedIsotropicSphereBackground,
  rendererIsotropicSphereBackground,
  type IsotropicBackgroundModel,
} from "../src/actionLab/background";
import { vectorNorm, type SphereModel, type Vec3 } from "../src/actionLab/math";

const sphere: SphereModel = { radius: 1, density: 1 };
const background: IsotropicBackgroundModel = { intensityPerSteradian: 1 };
const corridor = [1.05, 1.1, 1.2, 1.5, 2, 3, 5, 8] as const;

describe("Action Transport Lab A0.2 isotropic background fixture", () => {
  it("keeps all scalar channels positive and closes the incident ledger", () => {
    for (const distance of corridor) {
      const ledger = analyticIsotropicSphereBackground([distance, 0, 0], sphere, background);
      expect(ledger.incidentScalar).toBeCloseTo(4 * Math.PI, 13);
      expect(ledger.straightSurvivingScalar).toBeGreaterThan(0);
      expect(ledger.straightDeficitScalar).toBeGreaterThan(0);
      expect(ledger.deficitFraction).toBeGreaterThan(0);
      expect(ledger.deficitFraction).toBeLessThan(0.5);
      expect(ledger.straightFraction).toBeGreaterThan(0.5);
      expect(ledger.scalarClosureResidual).toBeLessThan(1e-12);
      expect(ledger.vectorClosureResidual).toBeLessThan(1e-12);
    }
  });

  it("produces the exact spherical-cap scalar deficit and 1/r^2 directional residual", () => {
    for (const distance of corridor) {
      const ledger = analyticIsotropicSphereBackground([distance, 0, 0], sphere, background);
      const alpha = Math.asin(1 / distance);
      const expectedDeficit = 2 * Math.PI * (1 - Math.cos(alpha));
      const expectedResidual = Math.PI / distance ** 2;
      expect(backgroundRelativeError(ledger.straightDeficitScalar, expectedDeficit)).toBeLessThan(1e-13);
      expect(backgroundRelativeError(ledger.residualMagnitude, expectedResidual)).toBeLessThan(1e-13);
      expect(ledger.residualFromDeficit[0]).toBeLessThan(0);
      expect(Math.abs(ledger.residualFromDeficit[1])).toBeLessThan(1e-14);
      expect(Math.abs(ledger.residualFromDeficit[2])).toBeLessThan(1e-14);
    }
  });

  it("keeps curved receiver-sphere integration on the analytic cap oracle", () => {
    for (const distance of corridor) {
      const probe: Vec3 = [distance, 0, 0];
      const analytic = analyticIsotropicSphereBackground(probe, sphere, background);
      const curved = curvedIsotropicSphereBackground(probe, sphere, background, 96);
      expect(backgroundRelativeError(curved.straightDeficitScalar, analytic.straightDeficitScalar)).toBeLessThan(2e-10);
      expect(backgroundRelativeError(curved.residualMagnitude, analytic.residualMagnitude)).toBeLessThan(2e-10);
      expect(curved.scalarClosureResidual).toBeLessThan(1e-12);
      expect(curved.vectorClosureResidual).toBeLessThan(1e-12);
    }
  });

  it("keeps renderer broad-cone first-hit sampling inside the frozen A0.2 tolerance", () => {
    for (const distance of corridor) {
      const probe: Vec3 = [distance, 0, 0];
      const analytic = analyticIsotropicSphereBackground(probe, sphere, background);
      const renderer = rendererIsotropicSphereBackground(probe, sphere, background, 4096);
      expect(renderer.hitCount).toBeGreaterThan(0);
      expect(renderer.hitCount).toBeLessThan(renderer.sampleCount);
      expect(renderer.proposalAngularRadius).toBeGreaterThanOrEqual(renderer.angularRadius);
      expect(backgroundRelativeError(renderer.straightDeficitScalar, analytic.straightDeficitScalar)).toBeLessThan(5e-4);
      expect(backgroundRelativeError(renderer.residualMagnitude, analytic.residualMagnitude)).toBeLessThan(5e-4);
      expect(renderer.scalarClosureResidual).toBeLessThan(1e-12);
      expect(renderer.vectorClosureResidual).toBeLessThan(1e-12);
    }
  });

  it("preserves frame covariance and points the residual toward the formed sphere", () => {
    const axis = 1 / Math.sqrt(3);
    const probe: Vec3 = [2 * axis, 2 * axis, 2 * axis];
    const expectedDirection: Vec3 = [-axis, -axis, -axis];
    const analytic = analyticIsotropicSphereBackground(probe, sphere, background);
    const curved = curvedIsotropicSphereBackground(probe, sphere, background, 96);
    const analyticDirection: Vec3 = [
      analytic.residualFromDeficit[0] / analytic.residualMagnitude,
      analytic.residualFromDeficit[1] / analytic.residualMagnitude,
      analytic.residualFromDeficit[2] / analytic.residualMagnitude,
    ];
    expect(vectorNorm([
      analyticDirection[0] - expectedDirection[0],
      analyticDirection[1] - expectedDirection[1],
      analyticDirection[2] - expectedDirection[2],
    ])).toBeLessThan(1e-13);
    expect(backgroundRelativeError(curved.residualMagnitude, analytic.residualMagnitude)).toBeLessThan(2e-10);
  });
});
