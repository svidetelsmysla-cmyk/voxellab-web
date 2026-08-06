import {
  buildGeneratedCavityResult,
  compareBoundaryResults,
  defaultRelaxationFixture,
  type BoundaryMode,
} from "../src/actionLab/cavityRelaxation";

const boundaries: BoundaryMode[] = [
  "ANALYTIC_ISOTROPIC_RESERVOIR",
  "SPHERICAL_REPULSIVE_WALL",
  "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL",
];

const results = boundaries.map((boundaryMode) => buildGeneratedCavityResult({
  ...defaultRelaxationFixture(boundaryMode),
  particleCount: 96,
  iterations: 160,
}));
const summary = compareBoundaryResults(results);

const receipt = {
  schema: "VOXELLAB_C0_C1_GENERATED_CAVITY_RELAXATION_GATE_V1",
  sourceClass: "DIRECT_PAIRWISE_DIMENSIONLESS_RELAXATION_CONTROL_ONLY",
  fixture: {
    reservoirRadius: 5,
    backgroundDensity: 1,
    particleCount: 96,
    bodyRadius: 0.65,
    bodyAmount: 16,
    iterations: 160,
  },
  summary,
  results: results.map((result) => ({
    boundaryMode: result.fixture.boundaryMode,
    c0Metrics: result.c0.metrics,
    c1Metrics: result.c1.metrics,
    cavityMetrics: result.cavity,
    radialProfile: result.radialProfile,
  })),
  claimCeiling: {
    physicalTime: false,
    physicalForce: false,
    upor: false,
    scaleBinding: false,
    validation: false,
    canonPromotion: false,
  },
};

console.log(JSON.stringify(receipt, null, 2));
