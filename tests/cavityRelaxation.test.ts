import { describe, expect, it } from "vitest";
import {
  buildGeneratedCavityResult,
  compareBoundaryResults,
  createInitialEqualBodyPositions,
  defaultRelaxationFixture,
  relaxEqualBodies,
  sampleGeneratedPoint,
  type BoundaryMode,
} from "../src/actionLab/cavityRelaxation";

const boundaries: BoundaryMode[] = [
  "ANALYTIC_ISOTROPIC_RESERVOIR",
  "SPHERICAL_REPULSIVE_WALL",
  "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL",
];

function smallFixture(boundaryMode: BoundaryMode) {
  return {
    ...defaultRelaxationFixture(boundaryMode),
    particleCount: 48,
    iterations: 70,
  };
}

describe("C0/C1 generated cavity relaxation", () => {
  it("keeps every background body and its positive amount through C0 and C1", () => {
    const result = buildGeneratedCavityResult(smallFixture("ANALYTIC_ISOTROPIC_RESERVOIR"));
    expect(result.c0.positions).toHaveLength(48);
    expect(result.c1.positions).toHaveLength(48);
    expect(result.c0.particleAmount).toBeGreaterThan(0);
    expect(result.c1.particleAmount).toBe(result.c0.particleAmount);
    expect(result.cavity.backgroundAmountResidual).toBeCloseTo(0, 13);
    expect(result.c0.metrics.amountResidual).toBeCloseTo(0, 12);
    expect(result.c1.metrics.amountResidual).toBeCloseTo(0, 12);
  });

  it("inserts a finite formed body without allowing background centres inside its occupied radius", () => {
    const result = buildGeneratedCavityResult(smallFixture("ANALYTIC_ISOTROPIC_RESERVOIR"));
    expect(result.c1.metrics.minimumRadius).toBeGreaterThan(result.fixture.bodyRadius);
    expect(result.cavity.nearestBackgroundRadius).toBe(result.c1.metrics.minimumRadius);
    expect(result.cavity.minimumDensityRatio).toBeGreaterThanOrEqual(0);
    expect(result.radialProfile).toHaveLength(24);
  });

  it("preserves the W vector identity full delta = body + background delta", () => {
    const result = buildGeneratedCavityResult(smallFixture("ANALYTIC_ISOTROPIC_RESERVOIR"));
    const sample = sampleGeneratedPoint([1.7, 0.35, -0.1], result);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(sample.fullDelta.w1[axis]).toBeCloseTo(sample.body.w1[axis]! + sample.backgroundDelta.w1[axis]!, 12);
    }
    expect(sample.c0Background.w0).toBeGreaterThan(0);
    expect(sample.c1Background.w0).toBeGreaterThan(0);
    expect(sample.body.w0).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed boundary, count and iteration cap", () => {
    const fixture = smallFixture("SPHERICAL_REPULSIVE_WALL");
    const initial = createInitialEqualBodyPositions(fixture);
    const first = relaxEqualBodies(initial, fixture, fixture.bodyAmount);
    const second = relaxEqualBodies(initial, fixture, fixture.bodyAmount);
    expect(first.positions).toEqual(second.positions);
    expect(first.metrics).toEqual(second.metrics);
  });

  it("runs all three preregistered boundary constructions without non-finite state", () => {
    const results = boundaries.map((boundaryMode) => buildGeneratedCavityResult(smallFixture(boundaryMode)));
    const summary = compareBoundaryResults(results);
    expect(summary.rows).toHaveLength(3);
    expect(summary.verdict).not.toBe("C0_C1_NUMERICAL_OR_PROVENANCE_BLOCKER");
    for (const result of results) {
      expect(result.c0.positions.flat().every((value) => Number.isFinite(value))).toBe(true);
      expect(result.c1.positions.flat().every((value) => Number.isFinite(value))).toBe(true);
      expect(result.c0.metrics.centreResidual).toBeLessThan(1e-3);
      expect(result.c1.metrics.centreResidual).toBeLessThan(1e-3);
    }
  });
});
