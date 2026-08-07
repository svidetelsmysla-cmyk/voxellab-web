import { describe, expect, it } from "vitest";
import {
  integrateFirstHitContinuousColumns,
  raySphereIntervalAt,
  singleSphereParity,
  type FormedClumpSphere,
} from "../src/actionLab/firstHitContinuousColumn";

const receiver = [0, 0, 0] as const;

describe("Action Transport Lab A3 first-hit continuous column", () => {
  it("returns exact entry/exit/chord geometry for a centred ray", () => {
    const clump: FormedClumpSphere = { id: "A", centre: [0, 0, 3], radius: 1, density: 2 };
    const interval = raySphereIntervalAt(receiver, [0, 0, 1], clump);
    expect(interval).not.toBeNull();
    expect(interval?.[0]).toBeCloseTo(2, 14);
    expect(interval?.[1]).toBeCloseTo(4, 14);
    expect((interval?.[1] ?? 0) - (interval?.[0] ?? 0)).toBeCloseTo(2, 14);
  });

  it("chooses only the first formed-domain owner while retaining the full owner chord", () => {
    const near: FormedClumpSphere = { id: "A", centre: [0, 0, 3], radius: 0.5, density: 1 };
    const far: FormedClumpSphere = { id: "B", centre: [0, 0, 5], radius: 1, density: 2 };
    const nearInterval = raySphereIntervalAt(receiver, [0, 0, 1], near);
    const farInterval = raySphereIntervalAt(receiver, [0, 0, 1], far);
    expect(nearInterval?.[0]).toBeCloseTo(2.5, 14);
    expect(farInterval?.[0]).toBeCloseTo(4, 14);

    const result = integrateFirstHitContinuousColumns(receiver, [near, far], 12288);
    expect(result.ownerCounts.A).toBeGreaterThan(0);
    expect(result.ownerCounts.B).toBeGreaterThan(0);
    const hitCells = result.cells.filter((cell) => cell.ownerId !== null);
    expect(hitCells.length + result.openSkyCount).toBe(result.sampleCount);
    expect(hitCells.every((cell) => cell.chord > 0 && cell.columnAmount > 0)).toBe(true);
  });

  it("converges the one-sphere first-owner column to both analytic volume and curved H(Omega) routes", () => {
    const clump: FormedClumpSphere = { id: "A", centre: [0, 0, 3], radius: 1, density: 1.25 };
    const parity = singleSphereParity(receiver, clump, 49152);
    expect(Math.abs(parity.curvedW0 - parity.analyticW0) / parity.analyticW0).toBeLessThan(2e-5);
    expect(Math.abs(parity.curvedW1 - parity.analyticW1) / parity.analyticW1).toBeLessThan(2e-5);
    expect(parity.relativeW0Error).toBeLessThan(2e-2);
    expect(parity.relativeW1Error).toBeLessThan(2e-2);
  });

  it("keeps a positive one-count column ledger", () => {
    const clumps: FormedClumpSphere[] = [
      { id: "A", centre: [-0.15, 0, 2.5], radius: 0.75, density: 1 },
      { id: "B", centre: [0.35, 0.05, 4.2], radius: 0.9, density: 1.35 },
    ];
    const result = integrateFirstHitContinuousColumns(receiver, clumps, 12288);
    const sum = result.cells.reduce((total, cell) => total + cell.columnAmount, 0);
    expect(result.cells.every((cell) => cell.columnAmount >= 0)).toBe(true);
    expect(sum).toBeCloseTo(result.w0, 12);
    expect(Object.values(result.ownerCounts).reduce((a, b) => a + b, 0) + result.openSkyCount).toBe(result.sampleCount);
  });

  it("preserves the one-sphere resultant magnitude under axis rotation within the finite angular grid", () => {
    const zScene: FormedClumpSphere = { id: "A", centre: [0, 0, 3], radius: 1, density: 1 };
    const xScene: FormedClumpSphere = { id: "A", centre: [3, 0, 0], radius: 1, density: 1 };
    const z = integrateFirstHitContinuousColumns(receiver, [zScene], 49152);
    const x = integrateFirstHitContinuousColumns(receiver, [xScene], 49152);
    expect(Math.abs(z.w0 - x.w0) / z.w0).toBeLessThan(2e-2);
    expect(Math.abs(z.w1Magnitude - x.w1Magnitude) / z.w1Magnitude).toBeLessThan(2e-2);
    expect(z.w1[2]).toBeGreaterThan(0);
    expect(x.w1[0]).toBeGreaterThan(0);
  });
});
