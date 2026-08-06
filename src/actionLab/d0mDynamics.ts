import {
  d0sMultipolePowers,
  generateD0SMicrobodies,
  type D0SLevelDefinition,
  type D0SLevelId,
  type D0SMultipolePowers,
  type D0SMicrobody,
} from "./d0sMicrobodyParity";
import { vectorNorm, type Vec3 } from "./math";

export type D0MLevelId = "N24" | "N48" | "N96" | "N192";
export type D0MMilestone = 1.1 | 1.25 | 1.5;

export interface D0MLevelDefinition {
  id: D0MLevelId;
  count: number;
  shellCount: number;
}

export interface D0MOperatorAudit {
  directPositiveCentralPair: true;
  pairedActionReaction: true;
  independentStatePerMicrobody: true;
  damping: false;
  softening: false;
  distanceCutoff: false;
  forceCap: false;
  velocityClipping: false;
  contact: false;
  upor: false;
  radialShellRestoration: false;
  neighbourRestLengths: false;
  shapeMatching: false;
  backgroundScreening: false;
  redirection: false;
  physicalSeconds: false;
}

export interface D0MTracePoint {
  step: number;
  tau: number;
  expansion: number;
  anisotropy: number;
  anisotropyDrift: number;
  tangentialKineticFraction: number;
  homologyResidual: number;
  outwardAmountFraction: number;
  relativeEnergyDrift: number;
  minimumPairRatio: number;
}

export interface D0MSnapshotMetrics {
  milestone: D0MMilestone;
  step: number;
  tau: number;
  expansion: number;
  overshoot: number;
  rRms: number;
  eigenvalues: [number, number, number];
  anisotropy: number;
  anisotropyDrift: number;
  homologousRate: number;
  homologyResidual: number;
  tangentialKineticFraction: number;
  outwardAmountFraction: number;
  multipoles: D0SMultipolePowers;
  p2GrowthRatio: number;
  p4GrowthRatio: number;
  minimumPairRatio: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  relativeEnergyDrift: number;
  centreOfAmountDriftOverInitialRms: number;
  normalizedLinearMomentumResidual: number;
  normalizedAngularMomentumResidual: number;
}

export interface D0MRunSummary {
  runId: string;
  level: D0MLevelDefinition;
  dt: number;
  tauMax: number;
  maximumSteps: number;
  initialRmsRadius: number;
  initialMinimumPairDistance: number;
  initialAnisotropy: number;
  initialMultipoles: D0SMultipolePowers;
  initialPotentialEnergy: number;
  amountClosureResidual: number;
  reachedAllMilestones: boolean;
  finite: boolean;
  singularEventCount: number;
  minimumPairRatioObserved: number;
  maximumCentreDriftOverInitialRms: number;
  maximumLinearMomentumResidual: number;
  maximumAngularMomentumResidual: number;
  snapshots: D0MSnapshotMetrics[];
  trace: D0MTracePoint[];
}

export interface D0MCovarianceResult {
  control: "ROTATION" | "PERMUTATION";
  maximumPositionStateRms: number;
  maximumVelocityStateRms: number;
  maximumStateRms: number;
  maximumScalarDelta: number;
  comparedMilestones: number;
}

export interface D0MTimeRefinementResult {
  level: "N96";
  coarseDt: 0.004;
  mediumDt: 0.002;
  fineDt: 0.001;
  anisotropyDeltaMediumFine: number;
  tangentialDeltaMediumFine: number;
  homologyDeltaMediumFine: number;
  energyDriftCoarse: number;
  energyDriftMedium: number;
  energyDriftFine: number;
}

export interface D0MGateStatus {
  id: string;
  label: string;
  value: number | boolean;
  threshold: number | boolean;
  pass: boolean;
}

export interface D0MParityResult {
  schema: "VOXELLAB_D0M_ISOLATED_INDEPENDENT_MICROBODY_DYNAMICS_V1";
  operatorAudit: D0MOperatorAudit;
  primaryRuns: D0MRunSummary[];
  timeRefinementRuns: D0MRunSummary[];
  rotationCovariance: D0MCovarianceResult;
  permutationCovariance: D0MCovarianceResult;
  timeRefinement: D0MTimeRefinementResult;
  gates: D0MGateStatus[];
  verdict:
    | "D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS"
    | "D0M_PACKING_ANISOTROPY_REFINEMENT_BLOCKER"
    | "D0M_TIME_INTEGRATION_OR_SINGULARITY_BLOCKER"
    | "D0M_MOTION_BRIDGE_PROVENANCE_BLOCKER";
  d0cStatus: "OPEN_AFTER_D0M_PASS" | "CLOSED_BY_D0M_BLOCKER";
  claimCeiling: string;
  firewalls: string[];
}

interface D0MState {
  ids: Int32Array;
  positions: Float64Array;
  velocities: Float64Array;
  amountFraction: number;
}

interface D0MInternalSnapshot {
  metrics: D0MSnapshotMetrics;
  ids: Int32Array;
  positions: Float64Array;
  velocities: Float64Array;
}

interface D0MInternalRun {
  summary: D0MRunSummary;
  internalSnapshots: D0MInternalSnapshot[];
}

interface SimulationOptions {
  runId: string;
  level: D0MLevelDefinition;
  dt: number;
  rotation?: { axis: Vec3; angle: number };
  permutation?: number[];
}

export const D0M_LEVELS: readonly D0MLevelDefinition[] = [
  { id: "N24", count: 24, shellCount: 3 },
  { id: "N48", count: 48, shellCount: 3 },
  { id: "N96", count: 96, shellCount: 4 },
  { id: "N192", count: 192, shellCount: 5 },
] as const;

export const D0M_MILESTONES: readonly D0MMilestone[] = [1.1, 1.25, 1.5] as const;
export const D0M_PRIMARY_DT = 0.001;
export const D0M_TAU_MAX = 3;
export const D0M_MAXIMUM_STEPS = 3000;

export const D0M_OPERATOR_AUDIT: D0MOperatorAudit = {
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
};

const ROTATION_AXIS = normalize([1, 2, 3]);
const ROTATION_ANGLE = 0.731;
const SINGULAR_DISTANCE_SQUARED = 1e-28;

function index3(index: number): number {
  return 3 * index;
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtract(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale(value: Vec3, factor: number): Vec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function normalize(value: Vec3): Vec3 {
  const magnitude = vectorNorm(value);
  if (!(magnitude > 0)) throw new Error("D0M cannot normalize a zero vector");
  return scale(value, 1 / magnitude);
}

function rotateAxisAngle(value: Vec3, axis: Vec3, angle: number): Vec3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return add(
    add(scale(value, cosine), scale(cross(axis, value), sine)),
    scale(axis, dot(axis, value) * (1 - cosine)),
  );
}

function asD0SDefinition(level: D0MLevelDefinition): D0SLevelDefinition {
  return {
    id: level.id as unknown as D0SLevelId,
    count: level.count,
    shellCount: level.shellCount,
  };
}

function deterministicPermutation(count: number): number[] {
  const values = Array.from({ length: count }, (_, index) => index);
  let state = 0x9e3779b9;
  for (let index = values.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    const temporary = values[index]!;
    values[index] = values[target]!;
    values[target] = temporary;
  }
  return values;
}

function initializeState(options: SimulationOptions): D0MState {
  const generated = generateD0SMicrobodies(
    { radius: 1, density: 1 },
    asD0SDefinition(options.level),
  ).bodies;
  const order = options.permutation ?? Array.from({ length: generated.length }, (_, index) => index);
  if (order.length !== generated.length) throw new Error("D0M permutation length mismatch");

  const ids = new Int32Array(generated.length);
  const positions = new Float64Array(3 * generated.length);
  const velocities = new Float64Array(3 * generated.length);
  for (let stateIndex = 0; stateIndex < order.length; stateIndex += 1) {
    const originalIndex = order[stateIndex]!;
    const body = generated[originalIndex];
    if (!body) throw new Error("D0M permutation contains an invalid index");
    ids[stateIndex] = originalIndex;
    const rotated = options.rotation
      ? rotateAxisAngle(body.position, options.rotation.axis, options.rotation.angle)
      : body.position;
    const offset = index3(stateIndex);
    positions[offset] = rotated[0];
    positions[offset + 1] = rotated[1];
    positions[offset + 2] = rotated[2];
  }
  return { ids, positions, velocities, amountFraction: 1 / generated.length };
}

function centreOfAmount(state: D0MState): Vec3 {
  let x = 0, y = 0, z = 0;
  for (let index = 0; index < state.ids.length; index += 1) {
    const offset = index3(index);
    x += state.amountFraction * state.positions[offset]!;
    y += state.amountFraction * state.positions[offset + 1]!;
    z += state.amountFraction * state.positions[offset + 2]!;
  }
  return [x, y, z];
}

function rmsRadius(state: D0MState, centre = centreOfAmount(state)): number {
  let total = 0;
  for (let index = 0; index < state.ids.length; index += 1) {
    const offset = index3(index);
    const dx = state.positions[offset]! - centre[0];
    const dy = state.positions[offset + 1]! - centre[1];
    const dz = state.positions[offset + 2]! - centre[2];
    total += state.amountFraction * (dx * dx + dy * dy + dz * dz);
  }
  return Math.sqrt(total);
}

function minimumPairDistance(positions: Float64Array): number {
  const count = positions.length / 3;
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < count; left += 1) {
    const leftOffset = index3(left);
    for (let right = left + 1; right < count; right += 1) {
      const rightOffset = index3(right);
      const dx = positions[leftOffset]! - positions[rightOffset]!;
      const dy = positions[leftOffset + 1]! - positions[rightOffset + 1]!;
      const dz = positions[leftOffset + 2]! - positions[rightOffset + 2]!;
      minimum = Math.min(minimum, Math.hypot(dx, dy, dz));
    }
  }
  return minimum;
}

function evaluateAccelerations(
  state: D0MState,
  accelerations: Float64Array,
): { minimumPairDistance: number; singularEvents: number } {
  accelerations.fill(0);
  const count = state.ids.length;
  let minimumDistanceSquared = Number.POSITIVE_INFINITY;
  let singularEvents = 0;
  for (let left = 0; left < count; left += 1) {
    const leftOffset = index3(left);
    for (let right = left + 1; right < count; right += 1) {
      const rightOffset = index3(right);
      const dx = state.positions[leftOffset]! - state.positions[rightOffset]!;
      const dy = state.positions[leftOffset + 1]! - state.positions[rightOffset + 1]!;
      const dz = state.positions[leftOffset + 2]! - state.positions[rightOffset + 2]!;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      minimumDistanceSquared = Math.min(minimumDistanceSquared, distanceSquared);
      if (!(distanceSquared > SINGULAR_DISTANCE_SQUARED)) {
        singularEvents += 1;
        continue;
      }
      const inverseDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
      const factor = state.amountFraction * inverseDistanceCubed;
      const ax = factor * dx;
      const ay = factor * dy;
      const az = factor * dz;
      accelerations[leftOffset] = accelerations[leftOffset]! + ax;
      accelerations[leftOffset + 1] = accelerations[leftOffset + 1]! + ay;
      accelerations[leftOffset + 2] = accelerations[leftOffset + 2]! + az;
      accelerations[rightOffset] = accelerations[rightOffset]! - ax;
      accelerations[rightOffset + 1] = accelerations[rightOffset + 1]! - ay;
      accelerations[rightOffset + 2] = accelerations[rightOffset + 2]! - az;
    }
  }
  return { minimumPairDistance: Math.sqrt(minimumDistanceSquared), singularEvents };
}

function symplecticStep(state: D0MState, accelerations: Float64Array, dt: number): {
  minimumPairDistance: number;
  singularEvents: number;
} {
  const pairResult = evaluateAccelerations(state, accelerations);
  for (let index = 0; index < state.positions.length; index += 1) {
    state.velocities[index] = state.velocities[index]! + accelerations[index]! * dt;
    state.positions[index] = state.positions[index]! + state.velocities[index]! * dt;
  }
  return pairResult;
}

function symmetricEigenvalues(
  xx: number,
  xy: number,
  xz: number,
  yy: number,
  yz: number,
  zz: number,
): [number, number, number] {
  const offDiagonalPower = xy * xy + xz * xz + yz * yz;
  if (offDiagonalPower <= 1e-30) {
    return [xx, yy, zz].sort((left, right) => right - left) as [number, number, number];
  }
  const mean = (xx + yy + zz) / 3;
  const centredPower = (xx - mean) ** 2 + (yy - mean) ** 2 + (zz - mean) ** 2 + 2 * offDiagonalPower;
  const scaleValue = Math.sqrt(centredPower / 6);
  const bxx = (xx - mean) / scaleValue;
  const bxy = xy / scaleValue;
  const bxz = xz / scaleValue;
  const byy = (yy - mean) / scaleValue;
  const byz = yz / scaleValue;
  const bzz = (zz - mean) / scaleValue;
  const determinant = bxx * (byy * bzz - byz * byz)
    - bxy * (bxy * bzz - byz * bxz)
    + bxz * (bxy * byz - byy * bxz);
  const halfDeterminant = Math.max(-1, Math.min(1, determinant / 2));
  const phi = Math.acos(halfDeterminant) / 3;
  const first = mean + 2 * scaleValue * Math.cos(phi);
  const third = mean + 2 * scaleValue * Math.cos(phi + 2 * Math.PI / 3);
  const second = 3 * mean - first - third;
  return [first, second, third].sort((left, right) => right - left) as [number, number, number];
}

function shapeMetrics(state: D0MState): {
  centre: Vec3;
  rRms: number;
  eigenvalues: [number, number, number];
  anisotropy: number;
  multipoles: D0SMultipolePowers;
} {
  const centre = centreOfAmount(state);
  const rRms = rmsRadius(state, centre);
  if (!(rRms > 0)) throw new Error("D0M RMS radius collapsed to zero");
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  const bodies: D0SMicrobody[] = [];
  for (let index = 0; index < state.ids.length; index += 1) {
    const offset = index3(index);
    const x = (state.positions[offset]! - centre[0]) / rRms;
    const y = (state.positions[offset + 1]! - centre[1]) / rRms;
    const z = (state.positions[offset + 2]! - centre[2]) / rRms;
    xx += state.amountFraction * x * x;
    xy += state.amountFraction * x * y;
    xz += state.amountFraction * x * z;
    yy += state.amountFraction * y * y;
    yz += state.amountFraction * y * z;
    zz += state.amountFraction * z * z;
    bodies.push({ position: [x, y, z], amount: state.amountFraction, shellIndex: 0 });
  }
  const eigenvalues = symmetricEigenvalues(xx, xy, xz, yy, yz, zz);
  const anisotropy = Math.sqrt(1.5 * eigenvalues.reduce(
    (sum, eigenvalue) => sum + (eigenvalue - 1 / 3) ** 2,
    0,
  ));
  return { centre, rRms, eigenvalues, anisotropy, multipoles: d0sMultipolePowers(bodies) };
}

function velocityMetrics(state: D0MState, centre: Vec3): {
  homologousRate: number;
  homologyResidual: number;
  tangentialKineticFraction: number;
  outwardAmountFraction: number;
  linearMomentum: Vec3;
  angularMomentum: Vec3;
  rmsSpeed: number;
  kineticEnergy: number;
} {
  let radialMoment = 0;
  let radiusSquared = 0;
  let speedSquared = 0;
  let tangentialSquared = 0;
  let outwardAmount = 0;
  let momentum: Vec3 = [0, 0, 0];
  let angularMomentum: Vec3 = [0, 0, 0];

  for (let index = 0; index < state.ids.length; index += 1) {
    const offset = index3(index);
    const radius: Vec3 = [
      state.positions[offset]! - centre[0],
      state.positions[offset + 1]! - centre[1],
      state.positions[offset + 2]! - centre[2],
    ];
    const velocity: Vec3 = [
      state.velocities[offset]!,
      state.velocities[offset + 1]!,
      state.velocities[offset + 2]!,
    ];
    const radiusMagnitude = vectorNorm(radius);
    const radialDot = dot(velocity, radius);
    radialMoment += state.amountFraction * radialDot;
    radiusSquared += state.amountFraction * dot(radius, radius);
    speedSquared += state.amountFraction * dot(velocity, velocity);
    momentum = add(momentum, scale(velocity, state.amountFraction));
    angularMomentum = add(angularMomentum, scale(cross(radius, velocity), state.amountFraction));
    if (radialDot > 0) outwardAmount += state.amountFraction;
    if (radiusMagnitude > 0) {
      const radialUnit = scale(radius, 1 / radiusMagnitude);
      const tangential = subtract(velocity, scale(radialUnit, dot(velocity, radialUnit)));
      tangentialSquared += state.amountFraction * dot(tangential, tangential);
    }
  }

  const homologousRate = radiusSquared > 0 ? radialMoment / radiusSquared : 0;
  let nonHomologousSquared = 0;
  for (let index = 0; index < state.ids.length; index += 1) {
    const offset = index3(index);
    const radius: Vec3 = [
      state.positions[offset]! - centre[0],
      state.positions[offset + 1]! - centre[1],
      state.positions[offset + 2]! - centre[2],
    ];
    const velocity: Vec3 = [
      state.velocities[offset]!,
      state.velocities[offset + 1]!,
      state.velocities[offset + 2]!,
    ];
    const residual = subtract(velocity, scale(radius, homologousRate));
    nonHomologousSquared += state.amountFraction * dot(residual, residual);
  }

  return {
    homologousRate,
    homologyResidual: speedSquared > 0 ? Math.sqrt(nonHomologousSquared / speedSquared) : 0,
    tangentialKineticFraction: speedSquared > 0 ? tangentialSquared / speedSquared : 0,
    outwardAmountFraction: outwardAmount,
    linearMomentum: momentum,
    angularMomentum,
    rmsSpeed: Math.sqrt(speedSquared),
    kineticEnergy: 0.5 * speedSquared,
  };
}

function potentialEnergy(state: D0MState): number {
  let potential = 0;
  for (let left = 0; left < state.ids.length; left += 1) {
    const leftOffset = index3(left);
    for (let right = left + 1; right < state.ids.length; right += 1) {
      const rightOffset = index3(right);
      const distance = Math.hypot(
        state.positions[leftOffset]! - state.positions[rightOffset]!,
        state.positions[leftOffset + 1]! - state.positions[rightOffset + 1]!,
        state.positions[leftOffset + 2]! - state.positions[rightOffset + 2]!,
      );
      if (!(distance > 0)) return Number.POSITIVE_INFINITY;
      potential += state.amountFraction * state.amountFraction / distance;
    }
  }
  return potential;
}

function makeSnapshot(
  state: D0MState,
  milestone: D0MMilestone,
  step: number,
  dt: number,
  initialRms: number,
  initialMinimumPair: number,
  initialAnisotropy: number,
  initialMultipoles: D0SMultipolePowers,
  initialEnergy: number,
): D0MInternalSnapshot {
  const shape = shapeMetrics(state);
  const velocity = velocityMetrics(state, shape.centre);
  const potential = potentialEnergy(state);
  const totalEnergy = velocity.kineticEnergy + potential;
  const expansion = shape.rRms / initialRms;
  const minimumPair = minimumPairDistance(state.positions);
  const p2Denominator = Math.max(initialMultipoles.l2, 1e-30);
  const p4Denominator = Math.max(initialMultipoles.l4, 1e-30);
  const metrics: D0MSnapshotMetrics = {
    milestone,
    step,
    tau: step * dt,
    expansion,
    overshoot: expansion - milestone,
    rRms: shape.rRms,
    eigenvalues: shape.eigenvalues,
    anisotropy: shape.anisotropy,
    anisotropyDrift: Math.abs(shape.anisotropy - initialAnisotropy),
    homologousRate: velocity.homologousRate,
    homologyResidual: velocity.homologyResidual,
    tangentialKineticFraction: velocity.tangentialKineticFraction,
    outwardAmountFraction: velocity.outwardAmountFraction,
    multipoles: shape.multipoles,
    p2GrowthRatio: shape.multipoles.l2 / p2Denominator,
    p4GrowthRatio: shape.multipoles.l4 / p4Denominator,
    minimumPairRatio: minimumPair / initialMinimumPair,
    kineticEnergy: velocity.kineticEnergy,
    potentialEnergy: potential,
    totalEnergy,
    relativeEnergyDrift: Math.abs(totalEnergy - initialEnergy) / Math.abs(initialEnergy),
    centreOfAmountDriftOverInitialRms: vectorNorm(shape.centre) / initialRms,
    normalizedLinearMomentumResidual: vectorNorm(velocity.linearMomentum),
    normalizedAngularMomentumResidual: vectorNorm(velocity.angularMomentum) / initialRms,
  };
  return {
    metrics,
    ids: new Int32Array(state.ids),
    positions: new Float64Array(state.positions),
    velocities: new Float64Array(state.velocities),
  };
}

function tracePoint(
  state: D0MState,
  step: number,
  dt: number,
  initialRms: number,
  initialMinimumPair: number,
  initialAnisotropy: number,
  initialEnergy: number,
  currentMinimumPair: number,
): D0MTracePoint {
  const shape = shapeMetrics(state);
  const velocity = velocityMetrics(state, shape.centre);
  const totalEnergy = velocity.kineticEnergy + potentialEnergy(state);
  return {
    step,
    tau: step * dt,
    expansion: shape.rRms / initialRms,
    anisotropy: shape.anisotropy,
    anisotropyDrift: Math.abs(shape.anisotropy - initialAnisotropy),
    tangentialKineticFraction: velocity.tangentialKineticFraction,
    homologyResidual: velocity.homologyResidual,
    outwardAmountFraction: velocity.outwardAmountFraction,
    relativeEnergyDrift: Math.abs(totalEnergy - initialEnergy) / Math.abs(initialEnergy),
    minimumPairRatio: currentMinimumPair / initialMinimumPair,
  };
}

function simulate(options: SimulationOptions): D0MInternalRun {
  const state = initializeState(options);
  const initialShape = shapeMetrics(state);
  const initialVelocity = velocityMetrics(state, initialShape.centre);
  const initialMinimumPair = minimumPairDistance(state.positions);
  const initialPotential = potentialEnergy(state);
  const initialEnergy = initialVelocity.kineticEnergy + initialPotential;
  const amountClosureResidual = state.ids.length * state.amountFraction - 1;
  const accelerations = new Float64Array(state.positions.length);
  const snapshots: D0MInternalSnapshot[] = [];
  const trace: D0MTracePoint[] = [];
  let nextMilestoneIndex = 0;
  let singularEventCount = 0;
  let minimumPairObserved = initialMinimumPair;
  let maximumCentreDrift = 0;
  let maximumMomentum = 0;
  let maximumAngularMomentum = 0;
  let finite = true;

  trace.push(tracePoint(
    state,
    0,
    options.dt,
    initialShape.rRms,
    initialMinimumPair,
    initialShape.anisotropy,
    initialEnergy,
    initialMinimumPair,
  ));

  const maximumSteps = Math.floor(D0M_TAU_MAX / options.dt + 1e-12);
  for (let step = 1; step <= maximumSteps && nextMilestoneIndex < D0M_MILESTONES.length; step += 1) {
    const pair = symplecticStep(state, accelerations, options.dt);
    singularEventCount += pair.singularEvents;
    minimumPairObserved = Math.min(minimumPairObserved, pair.minimumPairDistance);
    finite = finite && state.positions.every(Number.isFinite) && state.velocities.every(Number.isFinite);
    if (!finite || pair.singularEvents > 0) break;

    const centre = centreOfAmount(state);
    const currentRms = rmsRadius(state, centre);
    const velocity = velocityMetrics(state, centre);
    maximumCentreDrift = Math.max(maximumCentreDrift, vectorNorm(centre) / initialShape.rRms);
    maximumMomentum = Math.max(maximumMomentum, vectorNorm(velocity.linearMomentum));
    maximumAngularMomentum = Math.max(
      maximumAngularMomentum,
      vectorNorm(velocity.angularMomentum) / initialShape.rRms,
    );

    if (step % 20 === 0) {
      trace.push(tracePoint(
        state,
        step,
        options.dt,
        initialShape.rRms,
        initialMinimumPair,
        initialShape.anisotropy,
        initialEnergy,
        Math.min(pair.minimumPairDistance, minimumPairDistance(state.positions)),
      ));
    }

    const expansion = currentRms / initialShape.rRms;
    while (nextMilestoneIndex < D0M_MILESTONES.length && expansion >= D0M_MILESTONES[nextMilestoneIndex]!) {
      snapshots.push(makeSnapshot(
        state,
        D0M_MILESTONES[nextMilestoneIndex]!,
        step,
        options.dt,
        initialShape.rRms,
        initialMinimumPair,
        initialShape.anisotropy,
        initialShape.multipoles,
        initialEnergy,
      ));
      nextMilestoneIndex += 1;
    }
  }

  const publicSnapshots = snapshots.map((snapshot) => snapshot.metrics);
  const summary: D0MRunSummary = {
    runId: options.runId,
    level: options.level,
    dt: options.dt,
    tauMax: D0M_TAU_MAX,
    maximumSteps,
    initialRmsRadius: initialShape.rRms,
    initialMinimumPairDistance: initialMinimumPair,
    initialAnisotropy: initialShape.anisotropy,
    initialMultipoles: initialShape.multipoles,
    initialPotentialEnergy: initialPotential,
    amountClosureResidual,
    reachedAllMilestones: publicSnapshots.length === D0M_MILESTONES.length,
    finite,
    singularEventCount,
    minimumPairRatioObserved: minimumPairObserved / initialMinimumPair,
    maximumCentreDriftOverInitialRms: maximumCentreDrift,
    maximumLinearMomentumResidual: maximumMomentum,
    maximumAngularMomentumResidual: maximumAngularMomentum,
    snapshots: publicSnapshots,
    trace,
  };
  return { summary, internalSnapshots: snapshots };
}

function snapshotAt(run: D0MInternalRun, milestone: D0MMilestone): D0MInternalSnapshot {
  const snapshot = run.internalSnapshots.find((entry) => entry.metrics.milestone === milestone);
  if (!snapshot) throw new Error(`D0M run ${run.summary.runId} did not reach milestone ${milestone}`);
  return snapshot;
}

function publicSnapshotAt(run: D0MRunSummary, milestone: D0MMilestone): D0MSnapshotMetrics {
  const snapshot = run.snapshots.find((entry) => entry.milestone === milestone);
  if (!snapshot) throw new Error(`D0M run ${run.runId} did not reach milestone ${milestone}`);
  return snapshot;
}

function scalarSnapshotDelta(left: D0MSnapshotMetrics, right: D0MSnapshotMetrics): number {
  return Math.max(
    Math.abs(left.expansion - right.expansion),
    Math.abs(left.anisotropy - right.anisotropy),
    Math.abs(left.tangentialKineticFraction - right.tangentialKineticFraction),
    Math.abs(left.homologyResidual - right.homologyResidual),
    Math.abs(left.outwardAmountFraction - right.outwardAmountFraction),
    Math.abs(left.relativeEnergyDrift - right.relativeEnergyDrift),
  );
}

function compareCovariance(
  baseline: D0MInternalRun,
  variant: D0MInternalRun,
  control: D0MCovarianceResult["control"],
  inverseRotation?: { axis: Vec3; angle: number },
): D0MCovarianceResult {
  let maximumPositionStateRms = 0;
  let maximumVelocityStateRms = 0;
  let maximumScalarDelta = 0;
  let comparedMilestones = 0;

  for (const milestone of D0M_MILESTONES) {
    const base = snapshotAt(baseline, milestone);
    const other = snapshotAt(variant, milestone);
    const indexById = new Map<number, number>();
    for (let index = 0; index < other.ids.length; index += 1) indexById.set(other.ids[index]!, index);
    let positionSquared = 0;
    let velocitySquared = 0;
    let baseSpeedSquared = 0;
    for (let baseIndex = 0; baseIndex < base.ids.length; baseIndex += 1) {
      const id = base.ids[baseIndex]!;
      const otherIndex = indexById.get(id);
      if (otherIndex === undefined) throw new Error("D0M covariance id mismatch");
      const baseOffset = index3(baseIndex);
      const otherOffset = index3(otherIndex);
      let otherPosition: Vec3 = [
        other.positions[otherOffset]!,
        other.positions[otherOffset + 1]!,
        other.positions[otherOffset + 2]!,
      ];
      let otherVelocity: Vec3 = [
        other.velocities[otherOffset]!,
        other.velocities[otherOffset + 1]!,
        other.velocities[otherOffset + 2]!,
      ];
      if (inverseRotation) {
        otherPosition = rotateAxisAngle(otherPosition, inverseRotation.axis, inverseRotation.angle);
        otherVelocity = rotateAxisAngle(otherVelocity, inverseRotation.axis, inverseRotation.angle);
      }
      const basePosition: Vec3 = [
        base.positions[baseOffset]!,
        base.positions[baseOffset + 1]!,
        base.positions[baseOffset + 2]!,
      ];
      const baseVelocity: Vec3 = [
        base.velocities[baseOffset]!,
        base.velocities[baseOffset + 1]!,
        base.velocities[baseOffset + 2]!,
      ];
      const positionDelta = subtract(otherPosition, basePosition);
      const velocityDelta = subtract(otherVelocity, baseVelocity);
      positionSquared += baseline.summary.level.count ** -1 * dot(positionDelta, positionDelta);
      velocitySquared += baseline.summary.level.count ** -1 * dot(velocityDelta, velocityDelta);
      baseSpeedSquared += baseline.summary.level.count ** -1 * dot(baseVelocity, baseVelocity);
    }
    const positionRms = Math.sqrt(positionSquared) / base.metrics.rRms;
    const velocityRms = baseSpeedSquared > 0 ? Math.sqrt(velocitySquared / baseSpeedSquared) : 0;
    maximumPositionStateRms = Math.max(maximumPositionStateRms, positionRms);
    maximumVelocityStateRms = Math.max(maximumVelocityStateRms, velocityRms);
    maximumScalarDelta = Math.max(maximumScalarDelta, scalarSnapshotDelta(base.metrics, other.metrics));
    comparedMilestones += 1;
  }

  return {
    control,
    maximumPositionStateRms,
    maximumVelocityStateRms,
    maximumStateRms: Math.max(maximumPositionStateRms, maximumVelocityStateRms),
    maximumScalarDelta,
    comparedMilestones,
  };
}

function latestSnapshot(run: D0MRunSummary): D0MSnapshotMetrics | null {
  return run.snapshots.at(-1) ?? null;
}

function maximumAcrossRuns(runs: readonly D0MRunSummary[], selector: (run: D0MRunSummary) => number): number {
  return runs.reduce((maximum, run) => Math.max(maximum, selector(run)), 0);
}

function operatorAuditPass(audit: D0MOperatorAudit): boolean {
  return audit.directPositiveCentralPair
    && audit.pairedActionReaction
    && audit.independentStatePerMicrobody
    && !audit.damping
    && !audit.softening
    && !audit.distanceCutoff
    && !audit.forceCap
    && !audit.velocityClipping
    && !audit.contact
    && !audit.upor
    && !audit.radialShellRestoration
    && !audit.neighbourRestLengths
    && !audit.shapeMatching
    && !audit.backgroundScreening
    && !audit.redirection
    && !audit.physicalSeconds;
}

export function runD0MParity(): D0MParityResult {
  const primaryInternal = D0M_LEVELS.map((level) => simulate({
    runId: `PRIMARY_${level.id}_DT001`,
    level,
    dt: D0M_PRIMARY_DT,
  }));
  const primaryRuns = primaryInternal.map((run) => run.summary);
  const n96 = D0M_LEVELS.find((level) => level.id === "N96")!;
  const baselineN96 = primaryInternal.find((run) => run.summary.level.id === "N96")!;
  const coarseN96 = simulate({ runId: "TIME_N96_DT004", level: n96, dt: 0.004 });
  const mediumN96 = simulate({ runId: "TIME_N96_DT002", level: n96, dt: 0.002 });
  const rotationN96 = simulate({
    runId: "ROTATION_N96_DT001",
    level: n96,
    dt: 0.001,
    rotation: { axis: ROTATION_AXIS, angle: ROTATION_ANGLE },
  });
  const permutationN96 = simulate({
    runId: "PERMUTATION_N96_DT001",
    level: n96,
    dt: 0.001,
    permutation: deterministicPermutation(n96.count),
  });
  const timeRefinementRuns = [coarseN96.summary, mediumN96.summary, baselineN96.summary];
  const rotationCovariance = compareCovariance(
    baselineN96,
    rotationN96,
    "ROTATION",
    { axis: ROTATION_AXIS, angle: -ROTATION_ANGLE },
  );
  const permutationCovariance = compareCovariance(baselineN96, permutationN96, "PERMUTATION");

  const coarseFinal = publicSnapshotAt(coarseN96.summary, 1.5);
  const mediumFinal = publicSnapshotAt(mediumN96.summary, 1.5);
  const fineFinal = publicSnapshotAt(baselineN96.summary, 1.5);
  const timeRefinement: D0MTimeRefinementResult = {
    level: "N96",
    coarseDt: 0.004,
    mediumDt: 0.002,
    fineDt: 0.001,
    anisotropyDeltaMediumFine: Math.abs(mediumFinal.anisotropy - fineFinal.anisotropy),
    tangentialDeltaMediumFine: Math.abs(
      mediumFinal.tangentialKineticFraction - fineFinal.tangentialKineticFraction,
    ),
    homologyDeltaMediumFine: Math.abs(mediumFinal.homologyResidual - fineFinal.homologyResidual),
    energyDriftCoarse: coarseFinal.relativeEnergyDrift,
    energyDriftMedium: mediumFinal.relativeEnergyDrift,
    energyDriftFine: fineFinal.relativeEnergyDrift,
  };

  const allRegisteredRuns = [
    ...primaryRuns,
    coarseN96.summary,
    mediumN96.summary,
    rotationN96.summary,
    permutationN96.summary,
  ];
  const n24Run = primaryRuns.find((run) => run.level.id === "N24")!;
  const n192Run = primaryRuns.find((run) => run.level.id === "N192")!;
  const n24Final = latestSnapshot(n24Run);
  const n192Final = latestSnapshot(n192Run);
  if (!n24Final || !n192Final) {
    throw new Error("D0M primary runs did not create final snapshots");
  }
  const n192MaximumAnisotropyDrift = Math.max(...n192Run.snapshots.map((snapshot) => snapshot.anisotropyDrift));
  const n192MinimumOutward = Math.min(...n192Run.snapshots.map((snapshot) => snapshot.outwardAmountFraction));
  const maximumOvershoot = Math.max(...primaryRuns.flatMap(
    (run) => run.snapshots.map((snapshot) => snapshot.overshoot),
  ));
  const allFiniteAndReached = allRegisteredRuns.every((run) => run.finite && run.reachedAllMilestones);
  const maximumAmountResidual = maximumAcrossRuns(allRegisteredRuns, (run) => Math.abs(run.amountClosureResidual));
  const maximumCentreDrift = maximumAcrossRuns(allRegisteredRuns, (run) => run.maximumCentreDriftOverInitialRms);
  const maximumMomentum = maximumAcrossRuns(allRegisteredRuns, (run) => run.maximumLinearMomentumResidual);
  const maximumAngularMomentum = maximumAcrossRuns(allRegisteredRuns, (run) => run.maximumAngularMomentumResidual);
  const minimumPairRatio = allRegisteredRuns.reduce(
    (minimum, run) => Math.min(minimum, run.minimumPairRatioObserved),
    Number.POSITIVE_INFINITY,
  );
  const singularCount = allRegisteredRuns.reduce((sum, run) => sum + run.singularEventCount, 0);
  const provenancePass = operatorAuditPass(D0M_OPERATOR_AUDIT);

  const gates: D0MGateStatus[] = [
    { id: "G01", label: "all runs finite and reach expansion 1.50", value: allFiniteAndReached, threshold: true, pass: allFiniteAndReached },
    { id: "G02", label: "maximum amount closure residual", value: maximumAmountResidual, threshold: 1e-15, pass: maximumAmountResidual <= 1e-15 },
    { id: "G03", label: "maximum COM drift / initial RMS", value: maximumCentreDrift, threshold: 1e-11, pass: maximumCentreDrift <= 1e-11 },
    { id: "G04", label: "maximum normalized linear momentum", value: maximumMomentum, threshold: 1e-11, pass: maximumMomentum <= 1e-11 },
    { id: "G05", label: "maximum normalized angular momentum", value: maximumAngularMomentum, threshold: 1e-10, pass: maximumAngularMomentum <= 1e-10 },
    { id: "G06", label: "N192 relative total-energy drift at 1.50", value: n192Final.relativeEnergyDrift, threshold: 5e-3, pass: n192Final.relativeEnergyDrift <= 5e-3 },
    { id: "G07", label: "minimum pair ratio and no singular events", value: minimumPairRatio, threshold: 0.75, pass: minimumPairRatio >= 0.75 && singularCount === 0 },
    { id: "G08", label: "N192 minimum outward amount fraction", value: n192MinimumOutward, threshold: 0.95, pass: n192MinimumOutward >= 0.95 },
    { id: "G09", label: "N192 maximum anisotropy drift", value: n192MaximumAnisotropyDrift, threshold: 0.05, pass: n192MaximumAnisotropyDrift <= 0.05 },
    { id: "G10", label: "N192 tangential kinetic fraction at 1.50", value: n192Final.tangentialKineticFraction, threshold: 0.08, pass: n192Final.tangentialKineticFraction <= 0.08 },
    { id: "G11", label: "N192 homology residual at 1.50", value: n192Final.homologyResidual, threshold: 0.12, pass: n192Final.homologyResidual <= 0.12 },
    { id: "G12", label: "N192 P2/P4 growth ratios", value: Math.max(n192Final.p2GrowthRatio, n192Final.p4GrowthRatio), threshold: 1.5, pass: n192Final.p2GrowthRatio <= 1.5 && n192Final.p4GrowthRatio <= 1.5 },
    { id: "G13", label: "N192 improves A-drift, T and H versus N24", value: true, threshold: true, pass: n192Final.anisotropyDrift < n24Final.anisotropyDrift && n192Final.tangentialKineticFraction < n24Final.tangentialKineticFraction && n192Final.homologyResidual < n24Final.homologyResidual },
    { id: "G14", label: "rotation covariance", value: rotationCovariance.maximumStateRms, threshold: 1e-8, pass: rotationCovariance.maximumStateRms <= 1e-8 && rotationCovariance.maximumScalarDelta <= 1e-9 },
    { id: "G15", label: "permutation covariance", value: permutationCovariance.maximumStateRms, threshold: 1e-8, pass: permutationCovariance.maximumStateRms <= 1e-8 && permutationCovariance.maximumScalarDelta <= 1e-9 },
    { id: "G16", label: "time refinement", value: Math.max(timeRefinement.anisotropyDeltaMediumFine, timeRefinement.tangentialDeltaMediumFine, timeRefinement.homologyDeltaMediumFine), threshold: 0.01, pass: timeRefinement.anisotropyDeltaMediumFine <= 0.01 && timeRefinement.tangentialDeltaMediumFine <= 0.01 && timeRefinement.homologyDeltaMediumFine <= 0.01 && timeRefinement.energyDriftFine < timeRefinement.energyDriftCoarse },
    { id: "G17", label: "maximum primary milestone overshoot", value: maximumOvershoot, threshold: 0.005, pass: maximumOvershoot <= 0.005 },
    { id: "G18", label: "operator provenance audit", value: provenancePass, threshold: true, pass: provenancePass },
  ];

  const provenanceFailure = !gates.find((gate) => gate.id === "G18")!.pass;
  const timeOrSingularityFailure = ["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G14", "G15", "G16", "G17"]
    .some((id) => !gates.find((gate) => gate.id === id)!.pass);
  const pass = gates.every((gate) => gate.pass);
  const verdict = provenanceFailure
    ? "D0M_MOTION_BRIDGE_PROVENANCE_BLOCKER"
    : timeOrSingularityFailure
      ? "D0M_TIME_INTEGRATION_OR_SINGULARITY_BLOCKER"
      : pass
        ? "D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS"
        : "D0M_PACKING_ANISOTROPY_REFINEMENT_BLOCKER";

  return {
    schema: "VOXELLAB_D0M_ISOLATED_INDEPENDENT_MICROBODY_DYNAMICS_V1",
    operatorAudit: D0M_OPERATOR_AUDIT,
    primaryRuns,
    timeRefinementRuns,
    rotationCovariance,
    permutationCovariance,
    timeRefinement,
    gates,
    verdict,
    d0cStatus: verdict === "D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS"
      ? "OPEN_AFTER_D0M_PASS"
      : "CLOSED_BY_D0M_BLOCKER",
    claimCeiling: "DIRECT_PAIRWISE_DIMENSIONLESS_ISOLATED_MICROBODY_DYNAMICS_CONTROL_ONLY",
    firewalls: [
      "NO_RIGID_PARENT_MICROBODY_MOTION",
      "NO_SOFTENING_OR_FORCE_CAP",
      "NO_DAMPING",
      "NO_CONTACT_OR_UPOR_IN_D0M",
      "NO_SHAPE_TARGET",
      "NO_INTERPOLATED_VERDICT_STATE",
      "NO_TOLERANCE_FITTING",
      "NO_DIRECT_PAIRWISE_CONTROL_AS_FULL_VIKTOR_LAW",
      "NO_PHYSICAL_FORCE",
      "NO_UPOR_CLAIM",
      "NO_DIPOLE_VALIDATION",
      "NO_SCALE_BINDING",
      "NO_VALIDATION",
      "NO_CANON_PROMOTION",
      "NO_MERGE",
    ],
  };
}
