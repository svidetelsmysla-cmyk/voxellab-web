import { vectorNorm, type Vec3 } from "./math";

type MutableVec3 = [number, number, number];
type Matrix3 = [[number, number, number], [number, number, number], [number, number, number]];

const FOUR_PI_OVER_THREE = 4 * Math.PI / 3;
const INTENDED_INITIAL_RADIUS_FACTOR = 0.965;
const UNIFORM_BOUNDARY_SHELL_FRACTION = 1 - 0.85 ** 3;

export const C0A_THRESHOLDS = {
  sampler: {
    comOverRMaximum: 0.05,
    covarianceAnisotropyMaximum: 0.15,
    angularMomentAbsoluteMaximum: 0.08,
    radialCumulativeAmountMaximumAbsoluteError: 0.05,
    rotationMetricAbsoluteDeltaMaximum: 1e-12,
    duplicateSpacingFloorOverMeanSpacing: 1e-6,
  },
  continuumOracleRelativeResidualMaximum: 1e-12,
  c0: {
    legacyBulkDensityRmsMaximum: 0.35,
    highNCumulativeAmountMaximumAbsoluteError: 0.08,
    highNShellOscillationMaximum: 0.50,
    highNAnisotropyMaximum: 0.10,
    uniformBoundaryShellExpectedFraction: UNIFORM_BOUNDARY_SHELL_FRACTION,
    highNBoundaryShellFractionAbsoluteErrorMaximum: 0.10,
    relativeAmountResidualMaximum: 1e-12,
    nRefinementStability: {
      legacyRmsAbsoluteDeltaMaximum: 0.10,
      cumulativeAmountErrorAbsoluteDeltaMaximum: 0.04,
      anisotropyAbsoluteDeltaMaximum: 0.04,
      boundaryShellFractionAbsoluteDeltaMaximum: 0.05,
    },
    iterationRefinementStability: {
      legacyRmsAbsoluteDeltaMaximum: 0.10,
      cumulativeAmountErrorAbsoluteDeltaMaximum: 0.04,
      anisotropyAbsoluteDeltaMaximum: 0.04,
      boundaryShellFractionAbsoluteDeltaMaximum: 0.05,
    },
  },
} as const;

export interface C0AFixture {
  reservoirRadius: number;
  backgroundDensity: number;
  particleCount: number;
  iterations: number;
  softeningOverSpacing: number;
}

export interface SamplerAudit {
  particleCount: number;
  algorithm: "INDEPENDENT_HALTON_SPHERE_VOLUME_V1";
  sequencePassport: {
    indexOffset: 1;
    radialBase: 2;
    polarBase: 3;
    azimuthBase: 5;
    randomSeed: null;
  };
  comOverR: number;
  covarianceAnisotropy: number;
  angularMoments: { P1: number; P2: number; P3: number; P4: number };
  radialCumulativeAmountMaximumAbsoluteError: number;
  rotationCovarianceMaximumAbsoluteDelta: number;
  nearestNeighbourMinimumOverMeanSpacing: number;
  nearestNeighbourMeanOverMeanSpacing: number;
  pass: boolean;
}

export interface ContinuumOracleRow {
  radialFraction: number;
  aSelf: number;
  aReservoir: number;
  aTotal: number;
  relativeResidual: number;
}

export interface ContinuumOracleReceipt {
  rows: ContinuumOracleRow[];
  maximumRelativeResidual: number;
  pass: boolean;
}

export interface CoarseRadialRow {
  bin: number;
  radiusFraction: number;
  density: number;
}

export interface C0AMetrics {
  converged: boolean;
  iterationCount: number;
  finalMeanDisplacement: number;
  finalMaximumDisplacement: number;
  finalMeanDisplacementOverSpacing: number;
  finalMaximumDisplacementOverSpacing: number;
  centreResidualOverR: number;
  anisotropy: number;
  boundaryShellFraction: number;
  boundaryShellFractionAbsoluteError: number;
  minimumRadius: number;
  legacyBulkDensityRmsRelativeError: number;
  cumulativeEnclosedAmountMaximumAbsoluteError: number;
  shellOscillationAmplitude: number;
  totalPositiveAmount: number;
  totalPositiveAmountResidual: number;
  relativeAmountResidual: number;
  coarseRadialDensity: CoarseRadialRow[];
}

export interface C0ARunReceipt {
  fixture: C0AFixture;
  particleAmount: number;
  meanSpacing: number;
  metrics: C0AMetrics;
}

export type C0APrimaryVerdict =
  | "C0A_UNIFORM_CONTINUUM_BASELINE_RECOVERED_C1_REPLAY_OPEN"
  | "C0A_COARSE_GRAINED_UNIFORMITY_CONVERGES_WITH_FINITE_N_SHELLING"
  | "C0A_DISCRETE_DIRECT_PAIR_OPERATOR_FAILS_CONTINUUM_RECOVERY"
  | "C0A_NUMERICAL_CONVERGENCE_OR_SAMPLER_BLOCKER";

export interface StabilityReceipt {
  legacyRmsAbsoluteDelta: number;
  cumulativeAmountErrorAbsoluteDelta: number;
  anisotropyAbsoluteDelta: number;
  boundaryShellFractionAbsoluteDelta: number;
  pass: boolean;
}

export interface C0ARefinementReceipt {
  schema: "R14_C0A_UNIFORM_BACKGROUND_REFINEMENT_RUNTIME_V1";
  sourceClass: "METHOD_REPAIR_PLUS_INHERITED_R13_NUMERICAL_CONTROL";
  samplerAudits: SamplerAudit[];
  continuumOracle: ContinuumOracleReceipt;
  primaryNLadder: C0ARunReceipt[];
  iterationRefinement: C0ARunReceipt[];
  secondarySofteningControl: C0ARunReceipt[];
  nRefinementStability: StabilityReceipt;
  iterationRefinementStability: StabilityReceipt;
  highNPass: { N768: boolean; N1536: boolean };
  primaryVerdict: C0APrimaryVerdict;
  c1ReplayOpen: boolean;
  firewalls: string[];
}

function halton(index: number, base: number): number {
  let result = 0;
  let fraction = 1 / base;
  let value = index;
  while (value > 0) {
    result += fraction * (value % base);
    value = Math.floor(value / base);
    fraction /= base;
  }
  return result;
}

function validateCount(particleCount: number): void {
  if (!Number.isInteger(particleCount) || particleCount < 24) {
    throw new Error("particleCount must be an integer >= 24");
  }
}

function validateFixture(fixture: C0AFixture): void {
  validateCount(fixture.particleCount);
  if (!(fixture.reservoirRadius > 0)) throw new Error("reservoirRadius must be positive");
  if (!(fixture.backgroundDensity > 0)) throw new Error("backgroundDensity must be positive");
  if (!Number.isInteger(fixture.iterations) || fixture.iterations < 20) throw new Error("iterations must be an integer >= 20");
  if (!(fixture.softeningOverSpacing > 0)) throw new Error("softeningOverSpacing must be positive");
}

export function defaultC0AFixture(particleCount = 384, iterations = 160, softeningOverSpacing = 0.32): C0AFixture {
  return {
    reservoirRadius: 5,
    backgroundDensity: 1,
    particleCount,
    iterations,
    softeningOverSpacing,
  };
}

export function createRawIndependentSpherePositions(particleCount: number, reservoirRadius = 5): Vec3[] {
  validateCount(particleCount);
  if (!(reservoirRadius > 0)) throw new Error("reservoirRadius must be positive");
  const radius = INTENDED_INITIAL_RADIUS_FACTOR * reservoirRadius;
  const positions: Vec3[] = [];
  for (let i = 0; i < particleCount; i += 1) {
    const index = i + 1;
    const uRadial = halton(index, 2);
    const uPolar = halton(index, 3);
    const uAzimuth = halton(index, 5);
    const radial = radius * Math.cbrt(uRadial);
    const zCos = 1 - 2 * uPolar;
    const ring = Math.sqrt(Math.max(0, 1 - zCos * zCos));
    const phi = 2 * Math.PI * uAzimuth;
    positions.push([
      radial * ring * Math.cos(phi),
      radial * ring * Math.sin(phi),
      radial * zCos,
    ]);
  }
  return positions;
}

function meanVector(positions: readonly Vec3[]): MutableVec3 {
  const mean: MutableVec3 = [0, 0, 0];
  for (const position of positions) {
    mean[0] += position[0];
    mean[1] += position[1];
    mean[2] += position[2];
  }
  mean[0] /= positions.length;
  mean[1] /= positions.length;
  mean[2] /= positions.length;
  return mean;
}

function centeredPositions(positions: readonly Vec3[]): Vec3[] {
  const centre = meanVector(positions);
  return positions.map((position) => [
    position[0] - centre[0],
    position[1] - centre[1],
    position[2] - centre[2],
  ]);
}

function covarianceMatrix(positions: readonly Vec3[]): Matrix3 {
  const centred = centeredPositions(positions);
  const matrix: Matrix3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const position of centred) {
    matrix[0][0] += position[0] * position[0];
    matrix[0][1] += position[0] * position[1];
    matrix[0][2] += position[0] * position[2];
    matrix[1][0] += position[1] * position[0];
    matrix[1][1] += position[1] * position[1];
    matrix[1][2] += position[1] * position[2];
    matrix[2][0] += position[2] * position[0];
    matrix[2][1] += position[2] * position[1];
    matrix[2][2] += position[2] * position[2];
  }
  const inverse = 1 / centred.length;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) matrix[i]![j]! *= inverse;
  }
  return matrix;
}

function jacobiEigenvalues(matrix: Matrix3): [number, number, number] {
  const a = matrix.map((row) => [...row]) as Matrix3;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    let p = 0;
    let q = 1;
    let maximum = Math.abs(a[0][1]);
    for (const [i, j] of [[0, 2], [1, 2]] as const) {
      const value = Math.abs(a[i][j]);
      if (value > maximum) {
        maximum = value;
        p = i;
        q = j;
      }
    }
    if (maximum < 1e-14) break;
    const app = a[p]![p]!;
    const aqq = a[q]![q]!;
    const apq = a[p]![q]!;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let k = 0; k < 3; k += 1) {
      if (k === p || k === q) continue;
      const aik = a[p]![k]!;
      const aqk = a[q]![k]!;
      const nextP = c * aik - s * aqk;
      const nextQ = s * aik + c * aqk;
      a[p]![k] = nextP;
      a[k]![p] = nextP;
      a[q]![k] = nextQ;
      a[k]![q] = nextQ;
    }
    a[p]![p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q]![q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p]![q] = 0;
    a[q]![p] = 0;
  }
  return [a[0][0], a[1][1], a[2][2]].sort((left, right) => left - right) as [number, number, number];
}

function covarianceAnisotropy(positions: readonly Vec3[]): number {
  const eigenvalues = jacobiEigenvalues(covarianceMatrix(positions));
  return eigenvalues[0] > 1e-14 ? eigenvalues[2] / eigenvalues[0] - 1 : Number.POSITIVE_INFINITY;
}

function legendre(order: 1 | 2 | 3 | 4, x: number): number {
  if (order === 1) return x;
  if (order === 2) return 0.5 * (3 * x * x - 1);
  if (order === 3) return 0.5 * (5 * x ** 3 - 3 * x);
  return (35 * x ** 4 - 30 * x * x + 3) / 8;
}

function angularMoments(positions: readonly Vec3[]): { P1: number; P2: number; P3: number; P4: number } {
  const sums = [0, 0, 0, 0];
  for (const position of positions) {
    const radius = vectorNorm(position);
    const zCos = radius > 0 ? position[2] / radius : 0;
    sums[0]! += legendre(1, zCos);
    sums[1]! += legendre(2, zCos);
    sums[2]! += legendre(3, zCos);
    sums[3]! += legendre(4, zCos);
  }
  return {
    P1: sums[0]! / positions.length,
    P2: sums[1]! / positions.length,
    P3: sums[2]! / positions.length,
    P4: sums[3]! / positions.length,
  };
}

function radialSamplerCumulativeError(positions: readonly Vec3[], reservoirRadius: number): number {
  const intendedRadius = INTENDED_INITIAL_RADIUS_FACTOR * reservoirRadius;
  const fractions = positions
    .map((position) => (vectorNorm(position) / intendedRadius) ** 3)
    .sort((left, right) => left - right);
  let maximum = 0;
  for (let i = 0; i < fractions.length; i += 1) {
    maximum = Math.max(maximum, Math.abs((i + 1) / fractions.length - fractions[i]!));
  }
  return maximum;
}

function nearestNeighbourDiagnostics(positions: readonly Vec3[], reservoirRadius: number): { minimum: number; mean: number } {
  const volume = FOUR_PI_OVER_THREE * reservoirRadius ** 3;
  const spacing = Math.cbrt(volume / positions.length);
  let minimum = Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < positions.length; i += 1) {
    let nearest = Number.POSITIVE_INFINITY;
    for (let j = 0; j < positions.length; j += 1) {
      if (i === j) continue;
      const dx = positions[i]![0] - positions[j]![0];
      const dy = positions[i]![1] - positions[j]![1];
      const dz = positions[i]![2] - positions[j]![2];
      nearest = Math.min(nearest, Math.hypot(dx, dy, dz));
    }
    minimum = Math.min(minimum, nearest);
    sum += nearest;
  }
  return { minimum: minimum / spacing, mean: sum / positions.length / spacing };
}

function multiplyMatrix(left: Matrix3, right: Matrix3): Matrix3 {
  const result: Matrix3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      let value = 0;
      for (let k = 0; k < 3; k += 1) value += left[i]![k]! * right[k]![j]!;
      result[i]![j] = value;
    }
  }
  return result;
}

function transpose(matrix: Matrix3): Matrix3 {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ];
}

function rotatePositions(positions: readonly Vec3[], rotation: Matrix3): Vec3[] {
  return positions.map((position) => [
    rotation[0][0] * position[0] + rotation[0][1] * position[1] + rotation[0][2] * position[2],
    rotation[1][0] * position[0] + rotation[1][1] * position[1] + rotation[1][2] * position[2],
    rotation[2][0] * position[0] + rotation[2][1] * position[1] + rotation[2][2] * position[2],
  ]);
}

function rotationCovarianceDelta(positions: readonly Vec3[], reservoirRadius: number): number {
  const c = Math.SQRT1_2;
  const rotations: Matrix3[] = [
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[1, 0, 0], [0, c, -c], [0, c, c]],
  ];
  const base = covarianceMatrix(positions);
  let maximum = 0;
  for (const rotation of rotations) {
    const expected = multiplyMatrix(multiplyMatrix(rotation, base), transpose(rotation));
    const actual = covarianceMatrix(rotatePositions(positions, rotation));
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        maximum = Math.max(maximum, Math.abs(actual[i]![j]! - expected[i]![j]!) / reservoirRadius ** 2);
      }
    }
  }
  return maximum;
}

export function auditIndependentSphereSampler(particleCount: number, reservoirRadius = 5): SamplerAudit {
  const positions = createRawIndependentSpherePositions(particleCount, reservoirRadius);
  const centre = meanVector(positions);
  const moments = angularMoments(positions);
  const nearest = nearestNeighbourDiagnostics(positions, reservoirRadius);
  const receipt: SamplerAudit = {
    particleCount,
    algorithm: "INDEPENDENT_HALTON_SPHERE_VOLUME_V1",
    sequencePassport: { indexOffset: 1, radialBase: 2, polarBase: 3, azimuthBase: 5, randomSeed: null },
    comOverR: vectorNorm(centre) / reservoirRadius,
    covarianceAnisotropy: covarianceAnisotropy(positions),
    angularMoments: moments,
    radialCumulativeAmountMaximumAbsoluteError: radialSamplerCumulativeError(positions, reservoirRadius),
    rotationCovarianceMaximumAbsoluteDelta: rotationCovarianceDelta(positions, reservoirRadius),
    nearestNeighbourMinimumOverMeanSpacing: nearest.minimum,
    nearestNeighbourMeanOverMeanSpacing: nearest.mean,
    pass: false,
  };
  receipt.pass = receipt.comOverR <= C0A_THRESHOLDS.sampler.comOverRMaximum
    && receipt.covarianceAnisotropy <= C0A_THRESHOLDS.sampler.covarianceAnisotropyMaximum
    && Math.max(Math.abs(moments.P1), Math.abs(moments.P2), Math.abs(moments.P3), Math.abs(moments.P4)) <= C0A_THRESHOLDS.sampler.angularMomentAbsoluteMaximum
    && receipt.radialCumulativeAmountMaximumAbsoluteError <= C0A_THRESHOLDS.sampler.radialCumulativeAmountMaximumAbsoluteError
    && receipt.rotationCovarianceMaximumAbsoluteDelta <= C0A_THRESHOLDS.sampler.rotationMetricAbsoluteDeltaMaximum
    && receipt.nearestNeighbourMinimumOverMeanSpacing > C0A_THRESHOLDS.sampler.duplicateSpacingFloorOverMeanSpacing;
  return receipt;
}

export function buildB0ContinuumOracle(backgroundDensity = 1, reservoirRadius = 5): ContinuumOracleReceipt {
  if (!(backgroundDensity > 0 && reservoirRadius > 0)) throw new Error("continuum oracle inputs must be positive");
  const fractions = [0, 0.1, 0.25, 0.5, 0.75, 0.95];
  const rows = fractions.map((radialFraction): ContinuumOracleRow => {
    const radius = radialFraction * reservoirRadius;
    const aSelf = FOUR_PI_OVER_THREE * backgroundDensity * radius;
    const aReservoir = -FOUR_PI_OVER_THREE * backgroundDensity * radius;
    const aTotal = aSelf + aReservoir;
    const scale = Math.max(1, Math.abs(aSelf) + Math.abs(aReservoir));
    return { radialFraction, aSelf, aReservoir, aTotal, relativeResidual: Math.abs(aTotal) / scale };
  });
  const maximumRelativeResidual = Math.max(...rows.map((row) => row.relativeResidual));
  return { rows, maximumRelativeResidual, pass: maximumRelativeResidual <= C0A_THRESHOLDS.continuumOracleRelativeResidualMaximum };
}

function createRelaxationInitialFlat(fixture: C0AFixture): Float64Array {
  const raw = createRawIndependentSpherePositions(fixture.particleCount, fixture.reservoirRadius);
  const centre = meanVector(raw);
  const flat = new Float64Array(3 * fixture.particleCount);
  for (let i = 0; i < raw.length; i += 1) {
    flat[3 * i] = raw[i]![0] - centre[0];
    flat[3 * i + 1] = raw[i]![1] - centre[1];
    flat[3 * i + 2] = raw[i]![2] - centre[2];
  }
  return flat;
}

function recenterFlat(positions: Float64Array, particleCount: number): void {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < particleCount; i += 1) {
    x += positions[3 * i]!;
    y += positions[3 * i + 1]!;
    z += positions[3 * i + 2]!;
  }
  x /= particleCount;
  y /= particleCount;
  z /= particleCount;
  for (let i = 0; i < particleCount; i += 1) {
    positions[3 * i]! -= x;
    positions[3 * i + 1]! -= y;
    positions[3 * i + 2]! -= z;
  }
}

function enforceAnalyticDomain(positions: Float64Array, particleCount: number, maximumRadius: number): void {
  for (let i = 0; i < particleCount; i += 1) {
    const offset = 3 * i;
    const x = positions[offset]!;
    const y = positions[offset + 1]!;
    const z = positions[offset + 2]!;
    const radius = Math.hypot(x, y, z);
    if (radius > maximumRadius) {
      const factor = maximumRadius / radius;
      positions[offset] = x * factor;
      positions[offset + 1] = y * factor;
      positions[offset + 2] = z * factor;
    }
  }
}

function flatToVec3(positions: Float64Array, particleCount: number): Vec3[] {
  const result: Vec3[] = [];
  for (let i = 0; i < particleCount; i += 1) {
    result.push([positions[3 * i]!, positions[3 * i + 1]!, positions[3 * i + 2]!]);
  }
  return result;
}

function densityRows(positions: readonly Vec3[], amount: number, radius: number, bins: number): CoarseRadialRow[] {
  const counts = Array<number>(bins).fill(0);
  for (const position of positions) {
    const r = vectorNorm(position);
    const index = Math.min(bins - 1, Math.max(0, Math.floor(r / radius * bins)));
    counts[index]! += amount;
  }
  return counts.map((value, index) => {
    const r0 = radius * index / bins;
    const r1 = radius * (index + 1) / bins;
    const shellVolume = FOUR_PI_OVER_THREE * (r1 ** 3 - r0 ** 3);
    return { bin: index, radiusFraction: (index + 0.5) / bins, density: value / shellVolume };
  });
}

function legacyBulkDensityRms(positions: readonly Vec3[], amount: number, fixture: C0AFixture): number {
  const rows = densityRows(positions, amount, fixture.reservoirRadius, 14)
    .filter((row) => row.radiusFraction >= 0.2 && row.radiusFraction <= 0.6);
  const squared = rows.reduce((sum, row) => sum + ((row.density - fixture.backgroundDensity) / fixture.backgroundDensity) ** 2, 0);
  return rows.length > 0 ? Math.sqrt(squared / rows.length) : Number.POSITIVE_INFINITY;
}

function cumulativeEnclosedAmountError(positions: readonly Vec3[], reservoirRadius: number): number {
  let maximum = 0;
  for (let i = 1; i <= 17; i += 1) {
    const fraction = 0.05 * (i + 1);
    let count = 0;
    for (const position of positions) if (vectorNorm(position) <= fraction * reservoirRadius) count += 1;
    maximum = Math.max(maximum, Math.abs(count / positions.length - fraction ** 3));
  }
  return maximum;
}

function shellOscillation(rows: readonly CoarseRadialRow[], backgroundDensity: number): number {
  let squared = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const delta = (rows[i]!.density - rows[i - 1]!.density) / backgroundDensity;
    squared += delta * delta;
  }
  return rows.length > 1 ? Math.sqrt(squared / (rows.length - 1)) : Number.POSITIVE_INFINITY;
}

function buildMetrics(
  positionsFlat: Float64Array,
  fixture: C0AFixture,
  particleAmount: number,
  meanSpacing: number,
  iterationCount: number,
  finalMeanDisplacement: number,
  finalMaximumDisplacement: number,
  converged: boolean,
): C0AMetrics {
  const positions = flatToVec3(positionsFlat, fixture.particleCount);
  const expectedAmount = fixture.backgroundDensity * FOUR_PI_OVER_THREE * fixture.reservoirRadius ** 3;
  const actualAmount = particleAmount * fixture.particleCount;
  const amountResidual = actualAmount - expectedAmount;
  const centre = meanVector(positions);
  const coarse = densityRows(positions, particleAmount, fixture.reservoirRadius, 10);
  let boundaryCount = 0;
  let minimumRadius = Number.POSITIVE_INFINITY;
  for (const position of positions) {
    const radius = vectorNorm(position);
    minimumRadius = Math.min(minimumRadius, radius);
    if (radius > 0.85 * fixture.reservoirRadius) boundaryCount += 1;
  }
  const boundaryShellFraction = boundaryCount / positions.length;
  return {
    converged,
    iterationCount,
    finalMeanDisplacement,
    finalMaximumDisplacement,
    finalMeanDisplacementOverSpacing: finalMeanDisplacement / meanSpacing,
    finalMaximumDisplacementOverSpacing: finalMaximumDisplacement / meanSpacing,
    centreResidualOverR: vectorNorm(centre) / fixture.reservoirRadius,
    anisotropy: covarianceAnisotropy(positions),
    boundaryShellFraction,
    boundaryShellFractionAbsoluteError: Math.abs(boundaryShellFraction - UNIFORM_BOUNDARY_SHELL_FRACTION),
    minimumRadius,
    legacyBulkDensityRmsRelativeError: legacyBulkDensityRms(positions, particleAmount, fixture),
    cumulativeEnclosedAmountMaximumAbsoluteError: cumulativeEnclosedAmountError(positions, fixture.reservoirRadius),
    shellOscillationAmplitude: shellOscillation(coarse, fixture.backgroundDensity),
    totalPositiveAmount: actualAmount,
    totalPositiveAmountResidual: amountResidual,
    relativeAmountResidual: expectedAmount > 0 ? Math.abs(amountResidual) / expectedAmount : Number.POSITIVE_INFINITY,
    coarseRadialDensity: coarse,
  };
}

export function runC0ARelaxation(fixture: C0AFixture): C0ARunReceipt {
  validateFixture(fixture);
  const positions = createRelaxationInitialFlat(fixture);
  const volume = FOUR_PI_OVER_THREE * fixture.reservoirRadius ** 3;
  const totalAmount = fixture.backgroundDensity * volume;
  const particleAmount = totalAmount / fixture.particleCount;
  const meanSpacing = Math.cbrt(volume / fixture.particleCount);
  const softening = fixture.softeningOverSpacing * meanSpacing;
  const epsilonSquared = softening ** 2;
  const maximumStep = 0.075 * meanSpacing;
  const dt = 0.034;
  const tolerance = 2.5e-4 * meanSpacing;
  const maximumRadius = 1.25 * fixture.reservoirRadius;
  const accelerations = new Float64Array(positions.length);
  let finalMeanDisplacement = Number.POSITIVE_INFINITY;
  let finalMaximumDisplacement = Number.POSITIVE_INFINITY;
  let iterationCount = 0;
  let converged = false;

  for (let iteration = 0; iteration < fixture.iterations; iteration += 1) {
    accelerations.fill(0);
    for (let i = 0; i < fixture.particleCount; i += 1) {
      const leftOffset = 3 * i;
      const lx = positions[leftOffset]!;
      const ly = positions[leftOffset + 1]!;
      const lz = positions[leftOffset + 2]!;
      for (let j = i + 1; j < fixture.particleCount; j += 1) {
        const rightOffset = 3 * j;
        const dx = lx - positions[rightOffset]!;
        const dy = ly - positions[rightOffset + 1]!;
        const dz = lz - positions[rightOffset + 2]!;
        const denominator = (dx * dx + dy * dy + dz * dz + epsilonSquared) ** 1.5;
        const factor = particleAmount / denominator;
        const ax = dx * factor;
        const ay = dy * factor;
        const az = dz * factor;
        accelerations[leftOffset]! += ax;
        accelerations[leftOffset + 1]! += ay;
        accelerations[leftOffset + 2]! += az;
        accelerations[rightOffset]! -= ax;
        accelerations[rightOffset + 1]! -= ay;
        accelerations[rightOffset + 2]! -= az;
      }
    }

    const kappa = FOUR_PI_OVER_THREE * fixture.backgroundDensity;
    let displacementSum = 0;
    let displacementMaximum = 0;
    for (let i = 0; i < fixture.particleCount; i += 1) {
      const offset = 3 * i;
      let dx = dt * (accelerations[offset]! - kappa * positions[offset]!);
      let dy = dt * (accelerations[offset + 1]! - kappa * positions[offset + 1]!);
      let dz = dt * (accelerations[offset + 2]! - kappa * positions[offset + 2]!);
      const magnitude = Math.hypot(dx, dy, dz);
      if (magnitude > maximumStep) {
        const factor = maximumStep / magnitude;
        dx *= factor;
        dy *= factor;
        dz *= factor;
      }
      positions[offset]! += dx;
      positions[offset + 1]! += dy;
      positions[offset + 2]! += dz;
      const displacement = Math.hypot(dx, dy, dz);
      displacementSum += displacement;
      displacementMaximum = Math.max(displacementMaximum, displacement);
    }
    enforceAnalyticDomain(positions, fixture.particleCount, maximumRadius);
    recenterFlat(positions, fixture.particleCount);
    enforceAnalyticDomain(positions, fixture.particleCount, maximumRadius);
    finalMeanDisplacement = displacementSum / fixture.particleCount;
    finalMaximumDisplacement = displacementMaximum;
    iterationCount = iteration + 1;
    if (iteration >= 40 && finalMeanDisplacement < tolerance && finalMaximumDisplacement < 4 * tolerance) {
      converged = true;
      break;
    }
  }

  return {
    fixture,
    particleAmount,
    meanSpacing,
    metrics: buildMetrics(
      positions,
      fixture,
      particleAmount,
      meanSpacing,
      iterationCount,
      finalMeanDisplacement,
      finalMaximumDisplacement,
      converged,
    ),
  };
}

function finiteMetrics(run: C0ARunReceipt): boolean {
  const metrics = run.metrics;
  return [
    metrics.finalMeanDisplacement,
    metrics.finalMaximumDisplacement,
    metrics.finalMeanDisplacementOverSpacing,
    metrics.finalMaximumDisplacementOverSpacing,
    metrics.centreResidualOverR,
    metrics.anisotropy,
    metrics.boundaryShellFraction,
    metrics.boundaryShellFractionAbsoluteError,
    metrics.minimumRadius,
    metrics.legacyBulkDensityRmsRelativeError,
    metrics.cumulativeEnclosedAmountMaximumAbsoluteError,
    metrics.shellOscillationAmplitude,
    metrics.totalPositiveAmount,
    metrics.totalPositiveAmountResidual,
    metrics.relativeAmountResidual,
  ].every(Number.isFinite);
}

function highNPass(run: C0ARunReceipt): boolean {
  const metrics = run.metrics;
  const threshold = C0A_THRESHOLDS.c0;
  return metrics.legacyBulkDensityRmsRelativeError <= threshold.legacyBulkDensityRmsMaximum
    && metrics.cumulativeEnclosedAmountMaximumAbsoluteError <= threshold.highNCumulativeAmountMaximumAbsoluteError
    && metrics.shellOscillationAmplitude <= threshold.highNShellOscillationMaximum
    && metrics.anisotropy <= threshold.highNAnisotropyMaximum
    && metrics.boundaryShellFractionAbsoluteError <= threshold.highNBoundaryShellFractionAbsoluteErrorMaximum
    && metrics.relativeAmountResidual <= threshold.relativeAmountResidualMaximum;
}

function stability(left: C0ARunReceipt, right: C0ARunReceipt, thresholds: {
  legacyRmsAbsoluteDeltaMaximum: number;
  cumulativeAmountErrorAbsoluteDeltaMaximum: number;
  anisotropyAbsoluteDeltaMaximum: number;
  boundaryShellFractionAbsoluteDeltaMaximum: number;
}): StabilityReceipt {
  const receipt: StabilityReceipt = {
    legacyRmsAbsoluteDelta: Math.abs(left.metrics.legacyBulkDensityRmsRelativeError - right.metrics.legacyBulkDensityRmsRelativeError),
    cumulativeAmountErrorAbsoluteDelta: Math.abs(left.metrics.cumulativeEnclosedAmountMaximumAbsoluteError - right.metrics.cumulativeEnclosedAmountMaximumAbsoluteError),
    anisotropyAbsoluteDelta: Math.abs(left.metrics.anisotropy - right.metrics.anisotropy),
    boundaryShellFractionAbsoluteDelta: Math.abs(left.metrics.boundaryShellFraction - right.metrics.boundaryShellFraction),
    pass: false,
  };
  receipt.pass = receipt.legacyRmsAbsoluteDelta <= thresholds.legacyRmsAbsoluteDeltaMaximum
    && receipt.cumulativeAmountErrorAbsoluteDelta <= thresholds.cumulativeAmountErrorAbsoluteDeltaMaximum
    && receipt.anisotropyAbsoluteDelta <= thresholds.anisotropyAbsoluteDeltaMaximum
    && receipt.boundaryShellFractionAbsoluteDelta <= thresholds.boundaryShellFractionAbsoluteDeltaMaximum;
  return receipt;
}

function lookup(runs: readonly C0ARunReceipt[], particleCount: number, iterations: number, softening: number): C0ARunReceipt {
  const found = runs.find((run) => run.fixture.particleCount === particleCount
    && run.fixture.iterations === iterations
    && Math.abs(run.fixture.softeningOverSpacing - softening) < 1e-15);
  if (!found) throw new Error(`missing preregistered runtime N=${particleCount} iterations=${iterations} softening=${softening}`);
  return found;
}

export function classifyC0ARefinement(
  samplerAudits: SamplerAudit[],
  continuumOracle: ContinuumOracleReceipt,
  primaryNLadder: C0ARunReceipt[],
  iterationRefinement: C0ARunReceipt[],
  secondarySofteningControl: C0ARunReceipt[],
): C0ARefinementReceipt {
  const n768 = lookup(primaryNLadder, 768, 160, 0.32);
  const n1536 = lookup(primaryNLadder, 1536, 160, 0.32);
  const i320 = lookup(iterationRefinement, 384, 320, 0.32);
  const i640 = lookup(iterationRefinement, 384, 640, 0.32);
  const nRefinementStability = stability(n768, n1536, C0A_THRESHOLDS.c0.nRefinementStability);
  const iterationRefinementStability = stability(i320, i640, C0A_THRESHOLDS.c0.iterationRefinementStability);
  const highPass = { N768: highNPass(n768), N1536: highNPass(n1536) };
  const allSamplerPass = samplerAudits.length === 5 && samplerAudits.every((audit) => audit.pass);
  const allRuns = [...primaryNLadder, ...iterationRefinement, ...secondarySofteningControl];
  const numericalFinite = allRuns.every(finiteMetrics);
  const amountPass = allRuns.every((run) => run.metrics.relativeAmountResidual <= C0A_THRESHOLDS.c0.relativeAmountResidualMaximum);
  const coarseStable = highPass.N768 && highPass.N1536 && nRefinementStability.pass && iterationRefinementStability.pass;
  const strictRelaxationEvidence = n768.metrics.converged && n1536.metrics.converged && i640.metrics.converged;
  const stableNonUniformLimit = !highPass.N768 && !highPass.N1536 && nRefinementStability.pass && iterationRefinementStability.pass;

  let primaryVerdict: C0APrimaryVerdict;
  if (!allSamplerPass || !continuumOracle.pass || !numericalFinite || !amountPass) {
    primaryVerdict = "C0A_NUMERICAL_CONVERGENCE_OR_SAMPLER_BLOCKER";
  } else if (coarseStable && strictRelaxationEvidence) {
    primaryVerdict = "C0A_UNIFORM_CONTINUUM_BASELINE_RECOVERED_C1_REPLAY_OPEN";
  } else if (coarseStable) {
    primaryVerdict = "C0A_COARSE_GRAINED_UNIFORMITY_CONVERGES_WITH_FINITE_N_SHELLING";
  } else if (stableNonUniformLimit) {
    primaryVerdict = "C0A_DISCRETE_DIRECT_PAIR_OPERATOR_FAILS_CONTINUUM_RECOVERY";
  } else {
    primaryVerdict = "C0A_NUMERICAL_CONVERGENCE_OR_SAMPLER_BLOCKER";
  }

  return {
    schema: "R14_C0A_UNIFORM_BACKGROUND_REFINEMENT_RUNTIME_V1",
    sourceClass: "METHOD_REPAIR_PLUS_INHERITED_R13_NUMERICAL_CONTROL",
    samplerAudits,
    continuumOracle,
    primaryNLadder,
    iterationRefinement,
    secondarySofteningControl,
    nRefinementStability,
    iterationRefinementStability,
    highNPass: highPass,
    primaryVerdict,
    c1ReplayOpen: primaryVerdict === "C0A_UNIFORM_CONTINUUM_BASELINE_RECOVERED_C1_REPLAY_OPEN",
    firewalls: [
      "NO_NEW_PHYSICS_TO_RESCUE_C0",
      "NO_HARD_CORE_AS_VIKTOR_LAW",
      "NO_CONTACT_AS_UPOR",
      "NO_DAMPING_AS_PHYSICAL_TIME",
      "NO_TARGET_CAVITY_FITTING",
      "NO_BACKGROUND_AMOUNT_DESTRUCTION",
      "NO_SCALE_BINDING",
      "NO_VALIDATION",
      "NO_CANON_PROMOTION",
      "NO_MERGE",
    ],
  };
}
