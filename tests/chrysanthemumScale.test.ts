import { describe, expect, it } from "vitest";
import {
  asymptoticRawShellBudget,
  chrysanthemumShellScale,
  computeChrysanthemum,
  sharedFrontChange,
} from "../src/actionLab/chrysanthemumScale";

describe("Chrysanthemum external support scale", () => {
  it("reproduces the locally closed S10 diagnostic and converges in angular sampling", () => {
    const low = computeChrysanthemum(4, 1.4, 1024, "ORDERED_ANTIPODAL");
    const high = computeChrysanthemum(4, 1.4, 4096, "ORDERED_ANTIPODAL");
    expect(low.metrics.coverage).toBe(1);
    expect(high.metrics.coverage).toBe(1);
    expect(high.metrics.coefficientOfVariation).toBeGreaterThan(0.45);
    expect(high.metrics.coefficientOfVariation).toBeLessThan(0.49);
    expect(Math.abs(high.metrics.coefficientOfVariation - low.metrics.coefficientOfVariation)).toBeLessThan(0.01);
  });

  it("is unchanged by farther tiers after first-hit closure", () => {
    const k4 = computeChrysanthemum(4, 1.4, 4096, "ORDERED_ANTIPODAL");
    const k6 = computeChrysanthemum(6, 1.4, 4096, "ORDERED_ANTIPODAL");
    expect(k4.metrics.coverage).toBe(1);
    expect(k6.metrics.coverage).toBe(1);
    expect(sharedFrontChange(k6.result, k4.result)).toBeLessThan(1e-12);
    expect(k6.metrics.meanDepth).toBeCloseTo(k4.metrics.meanDepth, 12);
  });

  it("does not confuse the inserted S10 support radius with natural closure", () => {
    const generatorRadius = computeChrysanthemum(4, 0.2, 4096, "ORDERED_ANTIPODAL");
    expect(generatorRadius.metrics.coverage).toBeLessThan(0.2);
  });

  it("retains a finite lumpy terminal front under deterministic angular disorder once closed", () => {
    const disordered = computeChrysanthemum(6, 1.4, 4096, "RANDOM_ANTIPODAL", 1701);
    expect(disordered.metrics.coverage).toBeGreaterThan(0.999);
    expect(disordered.metrics.coefficientOfVariation).toBeGreaterThan(0.2);
  });

  it("shows the k^2 times inverse-square shell balance without calling it a force law", () => {
    const run = computeChrysanthemum(8, 0.2, 4096, "ORDERED_ANTIPODAL");
    const rows = chrysanthemumShellScale(run.result, run.bodies, 0.2, 8);
    const asymptote = asymptoticRawShellBudget(0.2);
    expect(rows[7]!.bodyCount).toBe(384);
    expect(rows[7]!.rawShellSolidAngleBudget).toBeGreaterThan(0);
    expect(rows[7]!.rawShellSolidAngleBudget).toBeLessThan(asymptote);
    expect(rows[7]!.rawShellSolidAngleBudget / asymptote).toBeGreaterThan(0.75);
    expect(rows[7]!.openFraction).toBeLessThan(rows[0]!.openFraction);
  });

  it("has exact normalized terminal-front collapse under a pure geometric scale change", () => {
    const base = computeChrysanthemum(6, 0.5, 4096, "ORDERED_ANTIPODAL", 1701, 1.0);
    const scaled = computeChrysanthemum(6, 1.0, 4096, "ORDERED_ANTIPODAL", 1701, 2.0);
    expect(scaled.metrics.coverage).toBe(base.metrics.coverage);
    expect(scaled.metrics.coefficientOfVariation).toBeCloseTo(base.metrics.coefficientOfVariation, 12);
    expect(scaled.metrics.robustLobeAmplitude).toBeCloseTo(base.metrics.robustLobeAmplitude, 12);
    expect(scaled.metrics.meanDepth / base.metrics.meanDepth).toBeCloseTo(2, 12);
    expect(scaled.metrics.meanDepth / 1.0).toBeCloseTo(base.metrics.meanDepth / 0.5, 12);
  });
});
