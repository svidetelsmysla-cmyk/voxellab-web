import { describe, expect, it } from "vitest";
import {
  freeBoundaryBounds,
  freeBoundaryParity,
  minimumShellThicknessRatioFromOverlapFraction,
  numericReferenceOverlap,
  overlapFractionFromSeparationRatio,
  referenceRows,
  sphereVolume,
} from "../src/actionLab/freeBoundaryBounds";

const close = (value: number, expected: number, digits = 12) => {
  expect(value).toBeCloseTo(expected, digits);
};

describe("Action Transport Lab A2B free-boundary geometry bounds", () => {
  it("returns zero displacement demand at contact and outside contact", () => {
    for (const ratio of [2, 2.1, 2.5]) {
      const bounds = freeBoundaryBounds({ radius: 1, separation: ratio });
      expect(bounds.overlapVolume).toBe(0);
      expect(bounds.overlapFraction).toBe(0);
      expect(bounds.displacedVolumePerClump).toBe(0);
      expect(bounds.minimumShellThicknessRatio).toBe(0);
      expect(bounds.branchStatus).toBe("NO_REFERENCE_CONFLICT");
    }
  });

  it("matches the exact default A2 displacement and lower-bound numbers", () => {
    const bounds = freeBoundaryBounds({ radius: 1, separation: 1.2 });
    close(bounds.sphereVolume, 4 * Math.PI / 3, 13);
    close(bounds.overlapFraction, 0.208, 13);
    close(bounds.displacedFractionPerClump, 0.104, 13);
    close(bounds.displacedVolumePerClump, 0.4356341812977847, 12);
    close(bounds.minimumShellThicknessRatio, 0.03352985047272461, 13);
    expect(bounds.branchStatus).toBe("DISTINCT_CLUMPS_FREE_BOUNDARY_REQUIRED");
    close(bounds.amountClosureResidual, 0, 13);
  });

  it("returns the exact concentric volume bound but blocks distinct-centre identity", () => {
    const bounds = freeBoundaryBounds({ radius: 1, separation: 0 });
    close(bounds.overlapFraction, 1, 13);
    close(bounds.displacedFractionPerClump, 0.5, 13);
    close(bounds.minimumOuterRadiusRatio, Math.cbrt(1.5), 13);
    close(bounds.minimumShellThicknessRatio, Math.cbrt(1.5) - 1, 13);
    expect(bounds.branchStatus).toBe("DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER");
  });

  it("is monotonic as the reference centres approach", () => {
    const ratios = Array.from({ length: 101 }, (_, index) => 2 - 2 * index / 100);
    let previousOverlap = -1;
    let previousShell = -1;
    for (const ratio of ratios) {
      const bounds = freeBoundaryBounds({ radius: 1, separation: ratio });
      expect(bounds.overlapFraction).toBeGreaterThanOrEqual(previousOverlap - 1e-14);
      expect(bounds.minimumShellThicknessRatio).toBeGreaterThanOrEqual(previousShell - 1e-14);
      previousOverlap = bounds.overlapFraction;
      previousShell = bounds.minimumShellThicknessRatio;
    }
  });

  it("matches exact overlap volume and first moment with independent numerical integration", () => {
    for (const ratio of [1.8, 1.2, 1, Math.sqrt(3) - 1, 0.2, 0]) {
      const parity = freeBoundaryParity({ radius: 1, separation: ratio });
      expect(parity.overlapVolumeRelativeError).toBeLessThan(1e-11);
      expect(parity.firstMomentRelativeError).toBeLessThan(1e-11);
      expect(Math.abs(parity.splitLedgerResidual)).toBeLessThan(1e-13);
      expect(Math.abs(parity.amountClosureResidual)).toBeLessThan(1e-13);
    }
  });

  it("keeps every physical amount and bound non-negative", () => {
    for (let index = 0; index <= 250; index += 1) {
      const ratio = 2.5 * index / 250;
      const bounds = freeBoundaryBounds({ radius: 1.7, separation: 1.7 * ratio });
      expect(bounds.overlapVolume).toBeGreaterThanOrEqual(0);
      expect(bounds.displacedVolumePerClump).toBeGreaterThanOrEqual(0);
      expect(bounds.requiredOutsideReferenceUnion).toBeGreaterThanOrEqual(0);
      expect(bounds.minimumShellThickness).toBeGreaterThanOrEqual(-1e-14);
      close(2 * bounds.displacedVolumePerClump, bounds.overlapVolume, 12);
    }
  });

  it("publishes the frozen reference corridor without selecting a physical contour", () => {
    const rows = referenceRows();
    expect(rows).toHaveLength(5);
    expect(rows[0]?.separationRatio).toBe(2);
    expect(rows.at(-1)?.branchStatus).toBe("DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER");
    close(overlapFractionFromSeparationRatio(1), 0.3125, 13);
    close(minimumShellThicknessRatioFromOverlapFraction(1), Math.cbrt(1.5) - 1, 13);
    close(sphereVolume(2), 32 * Math.PI / 3, 13);
    const numeric = numericReferenceOverlap({ radius: 1, separation: 2.1 });
    expect(numeric).toEqual({ volume: 0, firstMomentX: 0 });
  });
});
