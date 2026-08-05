import { describe, expect, it } from "vitest";
import {
  DUAL_MEMBERSHIP_PEAK_NORMALIZED,
  DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO,
  cubatureOverlap,
  equalSphereOverlapFirstMomentX,
  equalSphereOverlapVolume,
  exactDualMembershipNetMagnitude,
  normalizedDualMembershipCurve,
  overlapLedger,
  overlapParity,
  shellIntegratedOverlap,
  type EqualSphereOverlapModel,
} from "../src/actionLab/overlapGeometry";
import { sphereVolumeFromRadius } from "../src/actionLab/closure";

const fixture: EqualSphereOverlapModel = {
  radius: 1,
  separation: 1.2,
  backgroundIntensityPerSteradian: 1,
  receiverDensity: 1,
};

describe("Action Transport Lab A2 equal-sphere overlap geometry", () => {
  it("uses the exact equal-sphere lens volume and first moment", () => {
    const volume = equalSphereOverlapVolume(1, 1.2);
    expect(volume).toBeCloseTo(Math.PI * 5.2 * 0.8 ** 2 / 12, 13);
    expect(equalSphereOverlapFirstMomentX(1, 1.2)).toBeCloseTo(0.6 * volume, 13);
    expect(equalSphereOverlapVolume(1, 2)).toBe(0);
    expect(equalSphereOverlapVolume(1, 0)).toBeCloseTo(sphereVolumeFromRadius(1), 13);
  });

  it("preserves amount through union plus a separate positive compensation channel", () => {
    const ledger = overlapLedger(fixture);
    expect(ledger.unionOccupiedVolume + ledger.compensationAmount).toBeCloseTo(2 * ledger.sphereVolume, 13);
    expect(ledger.amountClosureResidual).toBeCloseTo(0, 13);
    expect(ledger.compensationAmount).toBeGreaterThan(0);
    expect(ledger.receiverExclusiveVolume).toBeGreaterThan(0);
  });

  it("derives the dual-membership bump without a fitted overlap spline", () => {
    expect(normalizedDualMembershipCurve(0)).toBe(0);
    expect(normalizedDualMembershipCurve(2)).toBe(0);
    expect(normalizedDualMembershipCurve(DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO))
      .toBeCloseTo(DUAL_MEMBERSHIP_PEAK_NORMALIZED, 13);
    expect(DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO).toBeCloseTo(Math.sqrt(3) - 1, 13);
    expect(DUAL_MEMBERSHIP_PEAK_NORMALIZED).toBeCloseTo(-4.5 + 3 * Math.sqrt(3), 13);
  });

  it("matches the exact overlap first-moment readout with curved-shell integration", () => {
    const exact = exactDualMembershipNetMagnitude(fixture);
    const shell = shellIntegratedOverlap(fixture, 128);
    expect(shell.dualMembershipNetW1[0]).toBeCloseTo(exact, 11);
    expect(shell.dualMembershipNetW1[1]).toBeCloseTo(0, 13);
    expect(shell.dualMembershipNetW1[2]).toBeCloseTo(0, 13);
  });

  it("independently recovers overlap volume, first moment and net with 3D cubature", () => {
    const parity = overlapParity(fixture);
    expect(parity.cubatureRelativeError).toBeLessThan(2.5e-2);
    expect(parity.overlapVolumeRelativeError).toBeLessThan(2.5e-2);
    expect(parity.overlapFirstMomentRelativeError).toBeLessThan(3.5e-2);
    expect(parity.normalizedTorque).toBeLessThan(2.5e-2);
  });

  it("keeps the unified exclusive-domain result resolved at zero while compensation remains unresolved", () => {
    const shell = shellIntegratedOverlap(fixture);
    const cubature = cubatureOverlap(fixture);
    expect(shell.resolvedUnifiedExclusiveW1).toEqual([0, 0, 0]);
    expect(cubature.resolvedUnifiedExclusiveW1).toEqual([0, 0, 0]);
    expect(shell.unresolvedCompensationAmount).toBeGreaterThan(0);
    expect(cubature.unresolvedCompensationAmount).toBeCloseTo(shell.unresolvedCompensationAmount, 13);
  });

  it("returns to the matched A1 zero outside overlap and at concentric symmetry", () => {
    const separated = { ...fixture, separation: 2.2 };
    expect(overlapLedger(separated).overlapVolume).toBe(0);
    expect(exactDualMembershipNetMagnitude(separated)).toBe(0);
    const concentric = { ...fixture, separation: 0 };
    expect(overlapLedger(concentric).overlapVolume).toBeCloseTo(sphereVolumeFromRadius(1), 13);
    expect(exactDualMembershipNetMagnitude(concentric)).toBe(0);
  });
});
