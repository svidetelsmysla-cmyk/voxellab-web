import { describe, expect, it } from "vitest";
import {
  auditIndependentSphereSampler,
  buildB0ContinuumOracle,
  createRawIndependentSpherePositions,
  defaultC0AFixture,
  runC0ARelaxation,
} from "../src/actionLab/c0aUniformBackground";

describe("R14 C0A uniform-background repair", () => {
  it("uses deterministic independent low-discrepancy coordinates and passes the preregistered N96 sampler gate", () => {
    const first = createRawIndependentSpherePositions(96);
    const second = createRawIndependentSpherePositions(96);
    expect(first).toEqual(second);
    expect(first).toHaveLength(96);

    const audit = auditIndependentSphereSampler(96);
    expect(audit.algorithm).toBe("INDEPENDENT_HALTON_SPHERE_VOLUME_V1");
    expect(audit.sequencePassport).toEqual({
      indexOffset: 1,
      radialBase: 2,
      polarBase: 3,
      azimuthBase: 5,
      randomSeed: null,
    });
    expect(audit.pass).toBe(true);
    expect(audit.comOverR).toBeLessThanOrEqual(0.05);
    expect(audit.covarianceAnisotropy).toBeLessThanOrEqual(0.15);
    expect(audit.radialCumulativeAmountMaximumAbsoluteError).toBeLessThanOrEqual(0.05);
  });

  it("closes the declared B0 continuum oracle to numerical zero", () => {
    const oracle = buildB0ContinuumOracle();
    expect(oracle.pass).toBe(true);
    expect(oracle.maximumRelativeResidual).toBeLessThanOrEqual(1e-12);
    for (const row of oracle.rows) {
      expect(row.aSelf + row.aReservoir).toBeCloseTo(0, 14);
      expect(row.aTotal).toBeCloseTo(0, 14);
    }
  });

  it("preserves all positive background amount in a deterministic small relaxation control", () => {
    const fixture = defaultC0AFixture(48, 50, 0.32);
    const first = runC0ARelaxation(fixture);
    const second = runC0ARelaxation(fixture);
    expect(first).toEqual(second);
    expect(first.metrics.totalPositiveAmount).toBeGreaterThan(0);
    expect(first.metrics.relativeAmountResidual).toBeLessThanOrEqual(1e-12);
    expect(first.metrics.centreResidualOverR).toBeLessThan(1e-12);
    expect(Number.isFinite(first.metrics.legacyBulkDensityRmsRelativeError)).toBe(true);
    expect(Number.isFinite(first.metrics.cumulativeEnclosedAmountMaximumAbsoluteError)).toBe(true);
    expect(Number.isFinite(first.metrics.shellOscillationAmplitude)).toBe(true);
  });
});
