import { describe, expect, it } from "vitest";
import {
  backgroundExteriorChannels,
  bodyW0UniformSphere,
  bodyW1UniformSphere,
  matchedOutgoingCoefficient,
  matchedUniformSourceDensity,
  normalizedOneBodyClosureSample,
  oneBodyClosureSample,
  totalAcceptedIsotropicAction,
  type ClosureModel,
} from "../src/actionLab/closure";
import type { SphereModel } from "../src/actionLab/math";

const sphere: SphereModel = { radius: 1, density: 1 };

describe("Action Transport Lab A0.3 one-body radial closure", () => {
  it("uses the exact uniform-sphere W0 centre and surface limits", () => {
    expect(bodyW0UniformSphere(0, sphere)).toBeCloseTo(4 * Math.PI, 13);
    expect(bodyW0UniformSphere(1, sphere)).toBeCloseTo(2 * Math.PI, 13);
    expect(bodyW0UniformSphere(2, sphere)).toBeGreaterThan(0);
  });

  it("uses the exact piecewise uniform-sphere W1 law and closes continuously at the surface", () => {
    expect(bodyW1UniformSphere(0, sphere)).toBe(0);
    expect(bodyW1UniformSphere(0.5, sphere)).toBeCloseTo(2 * Math.PI / 3, 13);
    expect(bodyW1UniformSphere(1, sphere)).toBeCloseTo(4 * Math.PI / 3, 13);
    expect(bodyW1UniformSphere(2, sphere)).toBeCloseTo(Math.PI / 3, 13);
  });

  it("derives the conditional closed-system coefficient without changing the background ledger", () => {
    expect(totalAcceptedIsotropicAction(1, 1)).toBeCloseTo(4 * Math.PI ** 2, 13);
    expect(matchedOutgoingCoefficient(1, 1)).toBeCloseTo(Math.PI, 13);
    expect(matchedUniformSourceDensity(1, 1)).toBeCloseTo(0.75, 13);
    const background = backgroundExteriorChannels(2, 1, 1);
    expect(background).not.toBeNull();
    expect(background?.residualMagnitude).toBeCloseTo(Math.PI / 4, 13);
  });

  it("shows exact exterior cancellation only when the constant source ratio is one", () => {
    const matched: ClosureModel = { radius: 1, backgroundIntensityPerSteradian: 1, sourceToMatchedRatio: 1 };
    for (const radiusRatio of [1, 1.05, 1.2, 2, 5, 8]) {
      const sample = oneBodyClosureSample(radiusRatio, matched);
      expect(sample.netDirectionalSigned).not.toBeNull();
      expect(Math.abs(sample.netDirectionalSigned ?? 1)).toBeLessThan(1e-13);
    }

    const weaker: ClosureModel = { ...matched, sourceToMatchedRatio: 0.7 };
    const stronger: ClosureModel = { ...matched, sourceToMatchedRatio: 1.3 };
    for (const radiusRatio of [1, 1.2, 2, 8]) {
      expect(oneBodyClosureSample(radiusRatio, weaker).netDirectionalSigned).toBeLessThan(0);
      expect(oneBodyClosureSample(radiusRatio, stronger).netDirectionalSigned).toBeGreaterThan(0);
    }
  });

  it("keeps the A0.2 background exterior-only while retaining the exact body interior branch", () => {
    const model: ClosureModel = { radius: 1, backgroundIntensityPerSteradian: 1, sourceToMatchedRatio: 1 };
    const inside = normalizedOneBodyClosureSample(0.5, model);
    expect(inside.bodyW1Magnitude).toBeCloseTo(0.5, 13);
    expect(inside.backgroundIncident).toBeNull();
    expect(inside.backgroundStraightDeficit).toBeNull();
    expect(inside.netDirectionalSigned).toBeNull();
  });

  it("shows that W0 retains near-field information even when the two exterior W1 branches coincide", () => {
    const model: ClosureModel = { radius: 1, backgroundIntensityPerSteradian: 1, sourceToMatchedRatio: 1 };
    const near = normalizedOneBodyClosureSample(1.2, model);
    const far = normalizedOneBodyClosureSample(100, model);
    expect(near.backgroundStraightDeficit).not.toBeNull();
    expect((near.backgroundStraightDeficit ?? 0) - near.bodyW0).toBeGreaterThan(0.1);
    expect(Math.abs((far.backgroundStraightDeficit ?? 0) - far.bodyW0)).toBeLessThan(1e-8);
  });
});
