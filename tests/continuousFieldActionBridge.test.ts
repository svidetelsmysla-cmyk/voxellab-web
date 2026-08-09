import { describe, expect, it } from "vitest";
import {
  buildProjectionDecomposition,
  compareActionMomentToReference,
  createSyntheticTwoOwnerFixture,
  createSyntheticUniformSphereFixture,
  estimateActionCurl,
  integrateContinuousFieldColumns,
  parseContinuousFieldSnapshot,
  runA4MethodGate,
  validateContinuousFieldSnapshot,
} from "../src/actionLab/continuousFieldActionBridge";
import { analyticSphereOutside } from "../src/actionLab/math";

describe("A4 continuous-field action bridge", () => {
  it("accepts the strict positive cell-centred snapshot contract", () => {
    const fixture = createSyntheticUniformSphereFixture(21);
    const validation = validateContinuousFieldSnapshot(fixture.snapshot);
    expect(validation.valid).toBe(true);
    expect(validation.voxelCount).toBe(21 ** 3);
    expect(validation.totalPositiveAmount).toBeGreaterThan(0);
    expect(validation.hasOwnerIds).toBe(true);
    expect(parseContinuousFieldSnapshot(JSON.parse(JSON.stringify(fixture.snapshot))).snapshotId)
      .toBe(fixture.snapshot.snapshotId);
  });

  it("rejects negative rho and incomplete frozen provenance", () => {
    const fixture = createSyntheticUniformSphereFixture(17);
    const rho = [...fixture.snapshot.rho];
    rho[Math.floor(rho.length / 2)] = -1;
    const negative = { ...fixture.snapshot, rho };
    expect(validateContinuousFieldSnapshot(negative).valid).toBe(false);

    const frozen = {
      ...fixture.snapshot,
      sourceClass: "FROZEN_V14" as const,
      provenance: {
        sourceCommit: "short",
        sourcePacketSha256: null,
        claimCeiling: fixture.snapshot.provenance.claimCeiling,
      },
    };
    expect(validateContinuousFieldSnapshot(frozen).valid).toBe(false);
  });

  it("converges the transparent K2 column to the analytic uniform-sphere W0/W1 oracle", () => {
    const fixture = createSyntheticUniformSphereFixture(33);
    const readout = integrateContinuousFieldColumns(
      fixture.snapshot,
      fixture.receiver,
      "TRANSPARENT_FULL_COLUMN",
      {
        directionCount: 16384,
        stepLength: Math.min(...fixture.snapshot.spacing) * 0.45,
      },
    );
    const analytic = analyticSphereOutside(fixture.receiver, fixture.analyticSphere!);
    expect(Math.abs(readout.w0 - analytic.w0) / analytic.w0).toBeLessThan(0.025);
    expect(Math.abs(readout.w1Magnitude - analytic.w1Magnitude) / analytic.w1Magnitude).toBeLessThan(0.025);
    expect(readout.w1[2]).toBeGreaterThan(0);
    expect(readout.traceClosureRelative).toBeLessThan(1e-12);
  });

  it("makes transparent and first-owner lanes identical for one source-exported owner", () => {
    const fixture = createSyntheticUniformSphereFixture(25);
    const decomposition = buildProjectionDecomposition(
      fixture.snapshot,
      fixture.receiver,
      { directionCount: 8192 },
    );
    expect(decomposition.firstOwnerColumn.w0).toBeCloseTo(decomposition.fullColumn.w0, 13);
    expect(decomposition.firstOwnerColumn.w1Magnitude)
      .toBeCloseTo(decomposition.fullColumn.w1Magnitude, 13);
    expect(decomposition.complementarySignedDiagnostic.w0).toBeCloseTo(0, 13);
    expect(decomposition.interpretation).toBe("SIGNED_READOUT_DIFFERENCE_NOT_NEGATIVE_MATTER");
  });

  it("keeps the first-owner control below the transparent column when a farther owner is occluded", () => {
    const fixture = createSyntheticTwoOwnerFixture(33);
    const decomposition = buildProjectionDecomposition(
      fixture.snapshot,
      fixture.receiver,
      { directionCount: 16384 },
    );
    expect(decomposition.fullColumn.w0).toBeGreaterThan(decomposition.firstOwnerColumn.w0);
    expect(decomposition.complementarySignedDiagnostic.w0).toBeGreaterThan(0);
    expect(decomposition.firstOwnerColumn.firstOwnerDirectionCounts["1"]).toBeGreaterThan(0);
    expect(decomposition.firstOwnerColumn.firstOwnerDirectionCounts["2"]).toBeGreaterThan(0);
  });

  it("provides curl and measured-vector comparison diagnostics without binding force", () => {
    const fixture = createSyntheticUniformSphereFixture(25);
    const readout = integrateContinuousFieldColumns(
      fixture.snapshot,
      fixture.receiver,
      "TRANSPARENT_FULL_COLUMN",
      { directionCount: 8192 },
    );
    const curl = estimateActionCurl(
      fixture.snapshot,
      fixture.receiver,
      2 * Math.min(...fixture.snapshot.spacing),
      "TRANSPARENT_FULL_COLUMN",
      { directionCount: 4096 },
    );
    expect(curl.normalizedCurl).toBeLessThan(0.2);
    const comparison = compareActionMomentToReference(readout, readout.w1);
    expect(comparison.cosineAlignment).toBeCloseTo(1, 12);
    expect(comparison.bestScalarCoefficient).toBeCloseTo(1, 12);
    expect(comparison.bestScaledRelativeResidual).toBeCloseTo(0, 12);
  });

  it("passes the preregistered method gate but keeps the real-snapshot blocker explicit", () => {
    const receipt = runA4MethodGate();
    expect(receipt.gates).toHaveLength(8);
    expect(receipt.gates.every((gate) => gate.pass)).toBe(true);
    expect(receipt.methodVerdict).toBe("A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_PASS");
    expect(receipt.overallVerdict).toBe("A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER");
    expect(receipt.snapshotExportStatus).toBe("NO_FROZEN_V5_V6_V14_RHO_SNAPSHOT_ATTACHED");
  });
});
