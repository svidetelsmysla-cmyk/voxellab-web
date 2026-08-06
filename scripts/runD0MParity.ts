import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runD0MParity } from "../src/actionLab/d0mDynamics";

const outputDirectory = resolve("outputs/D0M_ISOLATED_INDEPENDENT_MICROBODY_DYNAMICS_V1");
mkdirSync(outputDirectory, { recursive: true });

const result = runD0MParity();
const producerCommit = process.env.VITE_COMMIT_SHA || process.env.GITHUB_SHA || "LOCAL_UNATTESTED";
const receipt = {
  ...result,
  producerCommit,
  preregistration: "R13_D0M_ISOLATED_INDEPENDENT_MICROBODY_NORMALIZED_SHAPE_DYNAMICS_V1_PREREGISTRATION",
  generatedBy: "scripts/runD0MParity.ts",
};

writeFileSync(
  resolve(outputDirectory, "VOXELLAB_D0M_ISOLATED_MICROBODY_DYNAMICS_RECEIPT_V1.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);

const finalSnapshot = (run: (typeof result.primaryRuns)[number]) => run.snapshots.at(-1) ?? null;
const summary = {
  verdict: result.verdict,
  d0cStatus: result.d0cStatus,
  claimCeiling: result.claimCeiling,
  gateCount: result.gates.length,
  passedGates: result.gates.filter((gate) => gate.pass).length,
  failedGates: result.gates.filter((gate) => !gate.pass),
  primaryRuns: result.primaryRuns.map((run) => ({
    runId: run.runId,
    level: run.level,
    dt: run.dt,
    reachedAllMilestones: run.reachedAllMilestones,
    finite: run.finite,
    singularEventCount: run.singularEventCount,
    minimumPairRatioObserved: run.minimumPairRatioObserved,
    maximumCentreDriftOverInitialRms: run.maximumCentreDriftOverInitialRms,
    maximumLinearMomentumResidual: run.maximumLinearMomentumResidual,
    maximumAngularMomentumResidual: run.maximumAngularMomentumResidual,
    initialAnisotropy: run.initialAnisotropy,
    initialMultipoles: run.initialMultipoles,
    finalSnapshot: finalSnapshot(run),
  })),
  rotationCovariance: result.rotationCovariance,
  permutationCovariance: result.permutationCovariance,
  timeRefinement: result.timeRefinement,
  operatorAudit: result.operatorAudit,
};

writeFileSync(
  resolve(outputDirectory, "VOXELLAB_D0M_ISOLATED_MICROBODY_DYNAMICS_SUMMARY_V1.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));
