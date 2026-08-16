import { describe, expect, it } from "vitest";
import { computeChrysanthemum, sharedFrontChange } from "../src/actionLab/chrysanthemumScale";

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
});
