import { describe, expect, it } from "vitest";
import {
  buildCavityFixture,
  cavitySummary,
  radialCavityProfile,
  sampleCavityPoint,
  type CavityFixture,
} from "../src/actionLab/cavityFieldMap";

const fixture: CavityFixture = {
  reservoirRadius: 5,
  bodyRadius: 0.65,
  cavityRadius: 1.56,
  backgroundDensity: 1,
  refinement: "N768",
};

describe("C1 body + cavity + equal-body background", () => {
  it("preserves total positive amount by replacing removed background with the central body", () => {
    const built = buildCavityFixture(fixture);
    expect(built.ledger.removedBackgroundAmount).toBeGreaterThan(0);
    expect(built.ledger.bodyAmount).toBeCloseTo(built.ledger.removedBackgroundAmount, 13);
    expect(built.ledger.totalCurrentAmount).toBeCloseTo(built.ledger.baselineAmount, 13);
    expect(built.ledger.closureResidual).toBeCloseTo(0, 13);
  });

  it("keeps the cavity deficit as a positive subset of the baseline background", () => {
    const built = buildCavityFixture(fixture);
    const sample = sampleCavityPoint([2.2, 0.3, 0], fixture, built.particles, built.ledger);
    expect(sample.deficit.w0).toBeGreaterThan(0);
    expect(sample.baseline.w0).toBeCloseTo(sample.background.w0 + sample.deficit.w0, 11);
  });

  it("produces zero directed residual at the exact centre by symmetry", () => {
    const built = buildCavityFixture(fixture);
    const sample = sampleCavityPoint([0, 0, 0], fixture, built.particles, built.ledger);
    expect(sample.body.w1Magnitude).toBe(0);
    expect(sample.deficit.w1Magnitude).toBeLessThan(1e-10);
    expect(sample.residual.w1Magnitude).toBeLessThan(1e-10);
  });

  it("records an empty radial background profile inside the prescribed cavity", () => {
    const profile = radialCavityProfile(fixture, 28);
    const innerRows = profile.filter((row) => row.radius < fixture.cavityRadius * 0.85);
    expect(innerRows.length).toBeGreaterThan(0);
    expect(innerRows.every((row) => row.currentDensity === 0)).toBe(true);
    expect(profile.some((row) => row.currentDensity > 0)).toBe(true);
  });

  it("makes the central body denser than the displaced uniform background", () => {
    const summary = cavitySummary(fixture);
    expect(summary.bodyDensityRatio).toBeGreaterThan(1);
    expect(summary.cavityVolumeFraction).toBeGreaterThan(0);
    expect(summary.cavityVolumeFraction).toBeLessThan(1);
  });
});
