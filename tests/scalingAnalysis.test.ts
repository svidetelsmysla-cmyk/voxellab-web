import { describe, expect, it } from "vitest";
import {
  fitPowerLaw,
  hierarchyDimension,
  localPowerExponent,
  R15_Q_CRIT,
  r15FoldScaling,
  shellActionExponent,
} from "../src/actionLab/scalingAnalysis";

describe("scale-law analysis", () => {
  it("recovers inverse-square local exponent", () => {
    const x = [1, 2, 4, 8, 16];
    const y = x.map((r) => 3 / (r * r));
    const p = localPowerExponent(x, y);
    expect(p[2]).toBeCloseTo(2, 12);
  });

  it("converts geometric hierarchy ratios to a power dimension", () => {
    expect(hierarchyDimension(4, 2)).toBeCloseTo(2, 12);
    expect(shellActionExponent(2, 0)).toBeCloseTo(0, 12);
  });

  it("finds the universal local R15 fold exponents", () => {
    const rows = r15FoldScaling(42, 0.08).filter((row) => row.deltaQ < 0.02);
    const sep = fitPowerLaw(rows.map((row) => row.deltaQ), rows.map((row) => row.separation));
    const gap = fitPowerLaw(rows.map((row) => row.deltaQ), rows.map((row) => row.bGap));
    expect(R15_Q_CRIT).toBeGreaterThan(2);
    expect(sep.exponent).toBeCloseTo(0.5, 2);
    expect(gap.exponent).toBeCloseTo(1.5, 2);
    expect(sep.r2).toBeGreaterThan(0.999);
    expect(gap.r2).toBeGreaterThan(0.999);
  });
});
