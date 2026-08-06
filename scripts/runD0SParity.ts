import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runD0SParity } from "../src/actionLab/d0sMicrobodyParity";

const outputDirectory = resolve("outputs/D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_V1");
mkdirSync(outputDirectory, { recursive: true });

const result = runD0SParity({ radius: 1, density: 1 });
const compact = {
  ...result,
  producerCommit: process.env.VITE_COMMIT_SHA || process.env.GITHUB_SHA || "LOCAL_UNATTESTED",
  preregistration: "R13_D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_V1_PREREGISTRATION",
  generatedBy: "scripts/runD0SParity.ts",
};

const outputPath = resolve(outputDirectory, "VOXELLAB_D0S_STATIC_MICROBODY_PARITY_RECEIPT_V1.json");
writeFileSync(outputPath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");

const summary = {
  verdict: result.verdict,
  d0mStatus: result.d0mStatus,
  gateCount: result.gates.length,
  passedGates: result.gates.filter((gate) => gate.pass).length,
  levels: result.levels.map((level) => ({
    id: level.definition.id,
    count: level.definition.count,
    shellCounts: level.shellCounts,
    maxW0RelativeError: level.maximumW0RelativeError,
    maxW1MagnitudeRelativeError: level.maximumW1MagnitudeRelativeError,
    maxW1VectorRelativeError: level.maximumW1VectorRelativeError,
    maxW0OrientationSpread: level.maximumW0OrientationSpread,
    maxW1OrientationSpread: level.maximumW1OrientationSpread,
    centreOfAmountResidualOverR: level.centreOfAmountResidualOverR,
    equalWeightSpreadOverMean: level.equalWeightSpreadOverMean,
    permutationDelta: Math.max(level.permutationW0Delta, level.permutationW1Delta),
    rotationDelta: Math.max(level.rotationW0Delta, level.rotationW1Delta),
    multipoles: level.multipoles,
    worstVectorProbe: level.worstVectorProbe,
  })),
};

writeFileSync(
  resolve(outputDirectory, "VOXELLAB_D0S_STATIC_MICROBODY_PARITY_SUMMARY_V1.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));
if (result.verdict !== "D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS") process.exitCode = 1;
