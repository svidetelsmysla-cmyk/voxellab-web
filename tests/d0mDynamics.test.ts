import { describe, expect, it } from "vitest";
import {
  D0M_LEVELS,
  D0M_MILESTONES,
  D0M_OPERATOR_AUDIT,
  runD0MParity,
} from "../src/actionLab/d0mDynamics";

let cached: ReturnType<typeof runD0MParity> | null = null;
const result = () => cached ??= runD0MParity();

describe("D0M isolated independent-microbody normalized-shape dynamics", () => {
  it("freezes the independent direct-pair operator without hidden constitutive terms", () => {
    expect(D0M_OPERATOR_AUDIT).toEqual({
      directPositiveCentralPair: true,
      pairedActionReaction: true,
      independentStatePerMicrobody: true,
      damping: false,
      softening: false,
      distanceCutoff: false,
      forceCap: false,
      velocityClipping: false,
      contact: false,
      upor: false,
      radialShellRestoration: false,
      neighbourRestLengths: false,
      shapeMatching: false,
      backgroundScreening: false,
      redirection: false,
      physicalSeconds: false,
    });
  });

  it("runs the preregistered N24-N192 primary family with equal positive amount closure", () => {
    const output = result();
    expect(output.primaryRuns.map((run) => run.level.id)).toEqual(D0M_LEVELS.map((level) => level.id));
    for (const run of output.primaryRuns) {
      expect(run.level.count).toBeGreaterThan(0);
      expect(Math.abs(run.amountClosureResidual)).toBeLessThanOrEqual(1e-15);
      expect(run.finite).toBe(true);
      expect(run.singularEventCount).toBe(0);
      expect(run.minimumPairRatioObserved).toBeGreaterThan(0);
    }
  });

  it("records only completed-step milestone states without interpolation", () => {
    const output = result();
    for (const run of output.primaryRuns) {
      for (const snapshot of run.snapshots) {
        expect(D0M_MILESTONES).toContain(snapshot.milestone);
        expect(snapshot.step).toBeGreaterThan(0);
        expect(snapshot.tau).toBeCloseTo(snapshot.step * run.dt, 14);
        expect(snapshot.expansion).toBeGreaterThanOrEqual(snapshot.milestone);
        expect(snapshot.overshoot).toBeCloseTo(snapshot.expansion - snapshot.milestone, 14);
      }
    }
  });

  it("publishes finite normalized shape, homology, momentum and energy diagnostics", () => {
    const output = result();
    for (const run of [...output.primaryRuns, ...output.timeRefinementRuns]) {
      for (const snapshot of run.snapshots) {
        const values = [
          snapshot.rRms,
          ...snapshot.eigenvalues,
          snapshot.anisotropy,
          snapshot.anisotropyDrift,
          snapshot.homologousRate,
          snapshot.homologyResidual,
          snapshot.tangentialKineticFraction,
          snapshot.outwardAmountFraction,
          snapshot.minimumPairRatio,
          snapshot.kineticEnergy,
          snapshot.potentialEnergy,
          snapshot.totalEnergy,
          snapshot.relativeEnergyDrift,
          snapshot.centreOfAmountDriftOverInitialRms,
          snapshot.normalizedLinearMomentumResidual,
          snapshot.normalizedAngularMomentumResidual,
          snapshot.multipoles.l1,
          snapshot.multipoles.l2,
          snapshot.multipoles.l3,
          snapshot.multipoles.l4,
        ];
        expect(values.every(Number.isFinite)).toBe(true);
        expect(snapshot.eigenvalues.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 11);
        expect(snapshot.tangentialKineticFraction).toBeGreaterThanOrEqual(0);
        expect(snapshot.tangentialKineticFraction).toBeLessThanOrEqual(1 + 1e-12);
        expect(snapshot.outwardAmountFraction).toBeGreaterThanOrEqual(0);
        expect(snapshot.outwardAmountFraction).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });

  it("executes rotation, permutation and time-refinement controls by stable identity", () => {
    const output = result();
    expect(output.rotationCovariance.control).toBe("ROTATION");
    expect(output.rotationCovariance.comparedMilestones).toBeGreaterThanOrEqual(0);
    expect(output.permutationCovariance.control).toBe("PERMUTATION");
    expect(output.permutationCovariance.comparedMilestones).toBeGreaterThanOrEqual(0);
    expect(output.timeRefinement.level).toBe("N96");
    expect(output.timeRefinement.coarseDt).toBe(0.004);
    expect(output.timeRefinement.mediumDt).toBe(0.002);
    expect(output.timeRefinement.fineDt).toBe(0.001);
  });

  it("returns one governed verdict without promoting the direct branch", () => {
    const output = result();
    expect(output.gates).toHaveLength(18);
    expect([
      "D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS",
      "D0M_PACKING_ANISOTROPY_REFINEMENT_BLOCKER",
      "D0M_TIME_INTEGRATION_OR_SINGULARITY_BLOCKER",
      "D0M_MOTION_BRIDGE_PROVENANCE_BLOCKER",
    ]).toContain(output.verdict);
    expect(output.claimCeiling).toBe("DIRECT_PAIRWISE_DIMENSIONLESS_ISOLATED_MICROBODY_DYNAMICS_CONTROL_ONLY");
    expect(output.firewalls).toContain("NO_DIRECT_PAIRWISE_CONTROL_AS_FULL_VIKTOR_LAW");
  });
});
