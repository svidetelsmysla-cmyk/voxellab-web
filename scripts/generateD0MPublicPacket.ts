import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runD0MParity } from "../src/actionLab/d0mDynamics";

const result = runD0MParity();
const sourceProducerCommit = process.env.D0M_SOURCE_COMMIT
  || "d68e6e16954c21b19a32d0c7a90a5944d779fc44";
const projectionCommit = process.env.GITHUB_SHA || process.env.VITE_COMMIT_SHA || "LOCAL_UNATTESTED";

const levels = result.primaryRuns.map((run) => ({
  id: run.level.id,
  count: run.level.count,
  shellCount: run.level.shellCount,
  dt: run.dt,
  initial: {
    rRms: run.initialRmsRadius,
    minimumPairDistance: run.initialMinimumPairDistance,
    anisotropy: run.initialAnisotropy,
    multipoles: run.initialMultipoles,
    potentialEnergy: run.initialPotentialEnergy,
  },
  run: {
    reachedAllMilestones: run.reachedAllMilestones,
    finite: run.finite,
    singularEventCount: run.singularEventCount,
    minimumPairRatioObserved: run.minimumPairRatioObserved,
    maximumCentreDriftOverInitialRms: run.maximumCentreDriftOverInitialRms,
    maximumLinearMomentumResidual: run.maximumLinearMomentumResidual,
    maximumAngularMomentumResidual: run.maximumAngularMomentumResidual,
  },
  milestones: run.snapshots,
}));

const packet = {
  schema: "VOXELLAB_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1",
  sourceClass: "WORKER_METHOD_RESULT_NOT_CANON",
  publicRole: "READ_ONLY_GOVERNED_PLAYBACK_NO_BROWSER_PHYSICS_RECOMPUTATION",
  producer: {
    repository: "svidetelsmysla-cmyk/voxellab-web",
    branch: "r13/d0m-isolated-independent-microbody-normalized-shape-v1",
    sourceCommit: sourceProducerCommit,
    projectionCommit,
    preregistration: "docs/tasks/R13_D0M_ISOLATED_INDEPENDENT_MICROBODY_NORMALIZED_SHAPE_DYNAMICS_V1_PREREGISTRATION.md",
  },
  verdict: result.verdict,
  d0cStatus: result.d0cStatus,
  claimCeiling: result.claimCeiling,
  operatorAudit: result.operatorAudit,
  levels,
  gates: result.gates,
  rotationCovariance: result.rotationCovariance,
  permutationCovariance: result.permutationCovariance,
  timeRefinement: result.timeRefinement,
  receipt: {
    workflowRunId: 31081181415,
    jobId: 92550136008,
    artifactId: 8959521137,
    fullReceiptSha256: "3a5df4536699d244eafe3bd0d9ef85809bddf1b71928ce17967b6fcd34176078",
    summarySha256: "195332c33a1bee1b39b44af9ca60cd11be38479fff03f8a38a0a39fe011a9e6c",
    artifactZipSha256: "b6fc4e7ff58db7a860772150763a4cf879f71848d1809d121383edabfe30ef15",
    ci: "TYPECHECK_PASS_84_UNIT_TESTS_13_FILES_BUILD_PASS_DETERMINISTIC_RECEIPT_PASS",
  },
  interpretation: {
    size: "R_RMS_GROWS_BY_DIRECT_REPULSION",
    shape: "NORMALIZED_ANISOTROPY_AND_NONRADIAL_RESIDUAL_DECREASE_WITH_REFINEMENT",
    notEstablished: [
      "SELF_HELD_CLUMP",
      "FULL_VIKTOR_DYNAMIC_OPERATOR",
      "BACKGROUND_SCREENING_MOTION",
      "REDIRECTION_MOTION",
      "CONTACT_OR_UPOR",
      "PHYSICAL_TIME_OR_FORCE",
      "DIPOLE_STABILITY",
      "SCALE_BINDING",
      "VALIDATION",
      "CANON_PROMOTION",
    ],
  },
  firewalls: result.firewalls,
};

const outputDirectory = resolve("public/packets");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, "R13_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1.json"),
  `${JSON.stringify(packet, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify({
  verdict: packet.verdict,
  d0cStatus: packet.d0cStatus,
  levels: packet.levels.map((level) => level.id),
  gates: `${packet.gates.filter((gate) => gate.pass).length}/${packet.gates.length}`,
}, null, 2));
