import { describe, expect, it } from "vitest";
import { classifyStiffness2D, LiveReducedSubstrate2D } from "../src/actionLab/liveReducedSubstrate";

describe("A5 live reduced substrate runtime", () => {
  it("classifies wells, saddles, peaks and neutral directions from stiffness", () => {
    expect(classifyStiffness2D(2, 1, 0, 1e-9).className).toBe("WELL");
    expect(classifyStiffness2D(2, -1, 0, 1e-9).className).toBe("SADDLE");
    expect(classifyStiffness2D(-2, -1, 0, 1e-9).className).toBe("PEAK");
    expect(classifyStiffness2D(0, 2, 0, 1e-6).className).toBe("NEUTRAL");
  });

  it("evolves rho live while conserving the mean and refusing hidden clipping", () => {
    const runtime = new LiveReducedSubstrate2D({ n: 32, actionRelaxIterations: 1 });
    const before = Array.from(runtime.rho);
    const mean0 = runtime.metrics().rhoMean;
    runtime.step(4);
    expect(Array.from(runtime.rho).some((value, index) => Math.abs(value - before[index]!) > 1e-10)).toBe(true);
    expect(Math.abs(runtime.metrics().rhoMean - mean0)).toBeLessThan(1e-10);
    expect(runtime.metrics().stoppedReason).toBe(null);
  });

  it("produces same-step source-force equilibrium data without frozen frames", () => {
    const runtime = new LiveReducedSubstrate2D({ n: 32, actionRelaxIterations: 1 });
    runtime.step(2);
    const map = runtime.equilibriumMap(0.08, 0.06);
    expect(map.fx.length).toBe(32 ** 2);
    expect(map.lambdaMin.length).toBe(32 ** 2);
    expect(map.classes.length).toBe(32 ** 2);
    expect(map.forceScale).toBeGreaterThan(0);
    expect(map.stiffnessScale).toBeGreaterThan(0);
  });
});
