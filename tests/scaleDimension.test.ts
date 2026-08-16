import { describe, expect, it } from "vitest";
import {
  buildScaleDimensionProfile,
  compensationFraction,
  localScalingDimension,
  outerStableMean,
  type RadialMatterSample,
} from "../src/actionLab/scaleDimension";

function radialGridSamples(
  halfExtent: number,
  spacing: number,
  rho: (r: number) => number,
  reference: (r: number) => number,
): RadialMatterSample[] {
  const rows: RadialMatterSample[] = [];
  for (let z = -halfExtent; z <= halfExtent + 1e-12; z += spacing) {
    for (let y = -halfExtent; y <= halfExtent + 1e-12; y += spacing) {
      for (let x = -halfExtent; x <= halfExtent + 1e-12; x += spacing) {
        const r = Math.hypot(x, y, z);
        rows.push({ radius: r, rho: rho(r), rhoReference: reference(r) });
      }
    }
  }
  return rows;
}

describe("scale-dimension curve", () => {
  it("recovers a three-dimensional amount law for uniform matter", () => {
    const spacing = 0.25;
    const samples = radialGridSamples(3, spacing, () => 0.3, () => 0.3);
    const radii = Array.from({ length: 24 }, (_, i) => 0.7 * (2.5 / 0.7) ** (i / 23));
    const p = buildScaleDimensionProfile(samples, radii, spacing ** 3);
    expect(outerStableMean(p.dAmount, 7, 6)).toBeCloseTo(3, 1);
    expect(outerStableMean(p.dVolume, 7, 6)).toBeCloseTo(3, 1);
  });

  it("shows a compact relief becoming dimension-zero after it is enclosed", () => {
    const spacing = 0.2;
    const samples = radialGridSamples(
      3,
      spacing,
      (r) => 0.3 + (r < 0.7 ? 0.08 : 0),
      () => 0.3,
    );
    const radii = Array.from({ length: 26 }, (_, i) => 0.4 * (2.5 / 0.4) ** (i / 25));
    const p = buildScaleDimensionProfile(samples, radii, spacing ** 3);
    expect(Math.abs(outerStableMean(p.dRelief, 6, 10))).toBeLessThan(0.08);
    expect(outerStableMean(p.hMeanAbs, 6, 10)).toBeCloseTo(3, 1);
    expect(outerStableMean(p.hRms, 6, 10)).toBeCloseTo(1.5, 1);
  });

  it("keeps positive and negative relief as separate ledgers", () => {
    const samples: RadialMatterSample[] = [
      { radius: 0.2, rho: 1.2, rhoReference: 1.0 },
      { radius: 0.4, rho: 0.8, rhoReference: 1.0 },
      { radius: 0.6, rho: 1.0, rhoReference: 1.0 },
    ];
    const p = buildScaleDimensionProfile(samples, [0.7, 1.0, 1.4], 1);
    expect(p.mPlus[0]).toBeCloseTo(0.2, 12);
    expect(p.mMinus[0]).toBeCloseTo(0.2, 12);
    expect(compensationFraction(p.mPlus[0]!, p.mMinus[0]!)).toBeCloseTo(0, 12);
  });

  it("uses the sign of the log slope as a dimension, not a decay exponent", () => {
    const r = [1, 2, 4, 8, 16];
    const measure = r.map((x) => x * x);
    expect(localScalingDimension(r, measure)[2]).toBeCloseTo(2, 12);
  });
});
