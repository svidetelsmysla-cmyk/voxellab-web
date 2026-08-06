import { sphereVolume, vectorNorm, type FieldSample, type Vec3 } from "./math";

export type BoundaryMode =
  | "ANALYTIC_ISOTROPIC_RESERVOIR"
  | "SPHERICAL_REPULSIVE_WALL"
  | "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL";

export type GeneratedWChannel =
  | "C0_BACKGROUND_W0"
  | "C1_BACKGROUND_W0"
  | "BODY_W0"
  | "BACKGROUND_DELTA_W1"
  | "FULL_DELTA_W1";

type MutableVec3 = [number, number, number];

export interface RelaxationFixture {
  reservoirRadius: number;
  backgroundDensity: number;
  particleCount: number;
  bodyRadius: number;
  bodyAmount: number;
  boundaryMode: BoundaryMode;
  iterations: number;
}

export interface RelaxationMetrics {
  converged: boolean;
  iterationCount: number;
  finalMeanDisplacement: number;
  finalMaximumDisplacement: number;
  amount: number;
  amountResidual: number;
  centreResidual: number;
  anisotropy: number;
  boundaryShellFraction: number;
  minimumRadius: number;
  bulkDensityRmsRelativeError: number;
}

export interface RadialRelaxationRow {
  radius: number;
  c0Density: number;
  c1Density: number;
  c1ToC0Ratio: number;
}

export interface RelaxationState {
  positions: Vec3[];
  particleAmount: number;
  metrics: RelaxationMetrics;
}

export interface GeneratedCavityMetrics {
  farBulkDensity: number;
  minimumDensityRatio: number;
  cavityRadius50: number | null;
  cavityRadius90: number | null;
  backgroundAmountResidual: number;
  nearestBackgroundRadius: number;
}

export interface GeneratedCavityResult {
  fixture: RelaxationFixture;
  c0: RelaxationState;
  c1: RelaxationState;
  radialProfile: RadialRelaxationRow[];
  cavity: GeneratedCavityMetrics;
}

export interface GeneratedPointSample {
  c0Background: FieldSample;
  c1Background: FieldSample;
  body: FieldSample;
  backgroundDelta: FieldSample;
  fullDelta: FieldSample;
}

export interface BoundaryComparisonRow {
  boundaryMode: BoundaryMode;
  c0BulkDensityError: number;
  c0Anisotropy: number;
  c0BoundaryShellFraction: number;
  c1CavityRadius50: number | null;
  c1CavityRadius90: number | null;
  c1MinimumDensityRatio: number;
  c1NearestBackgroundRadius: number;
  c0Converged: boolean;
  c1Converged: boolean;
}

export interface BoundaryGateSummary {
  verdict:
    | "C0_C1_GENERATED_CAVITY_BOUNDARY_ROBUST_PASS"
    | "C0_C1_CAVITY_GENERATED_BUT_BOUNDARY_DEPENDENT"
    | "C0_UNIFORM_BACKGROUND_NOT_OBTAINED"
    | "C1_NO_GENERATED_CAVITY"
    | "C0_C1_NUMERICAL_OR_PROVENANCE_BLOCKER";
  rows: BoundaryComparisonRow[];
  cavityRadius50RelativeSpread: number | null;
  thresholds: {
    analyticC0BulkRmsMaximum: number;
    generatedCavityMinimumRadiusFactor: number;
    boundaryRobustRelativeSpreadMaximum: number;
  };
}

const FOUR_PI_OVER_THREE = 4 * Math.PI / 3;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function addMutable(target: MutableVec3, value: Vec3, factor = 1): void {
  target[0] += value[0] * factor;
  target[1] += value[1] * factor;
  target[2] += value[2] * factor;
}

function subtract(a: Vec3, b: Vec3): MutableVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(value: Vec3, factor: number): MutableVec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function clonePositions(values: readonly Vec3[]): MutableVec3[] {
  return values.map((value) => [value[0], value[1], value[2]]);
}

function finiteVec(value: Vec3): boolean {
  return Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2]);
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

function equalVolumeCubeHalfWidth(radius: number): number {
  return radius * Math.cbrt(Math.PI / 6);
}

function containerVolume(fixture: RelaxationFixture): number {
  if (fixture.boundaryMode === "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL") {
    const half = equalVolumeCubeHalfWidth(fixture.reservoirRadius);
    return (2 * half) ** 3;
  }
  return sphereVolume({ radius: fixture.reservoirRadius, density: 1 });
}

function validateFixture(fixture: RelaxationFixture): void {
  if (!(fixture.reservoirRadius > 0)) throw new Error("reservoirRadius must be positive");
  if (!(fixture.backgroundDensity > 0)) throw new Error("backgroundDensity must be positive");
  if (!Number.isInteger(fixture.particleCount) || fixture.particleCount < 24) throw new Error("particleCount must be an integer >= 24");
  if (!(fixture.bodyRadius > 0 && fixture.bodyRadius < fixture.reservoirRadius * 0.4)) throw new Error("bodyRadius outside gate corridor");
  if (!(fixture.bodyAmount > 0)) throw new Error("bodyAmount must be positive");
  if (!Number.isInteger(fixture.iterations) || fixture.iterations < 20) throw new Error("iterations must be an integer >= 20");
}

export function defaultRelaxationFixture(boundaryMode: BoundaryMode = "ANALYTIC_ISOTROPIC_RESERVOIR"): RelaxationFixture {
  return {
    reservoirRadius: 5,
    backgroundDensity: 1,
    particleCount: 192,
    bodyRadius: 0.65,
    bodyAmount: 16,
    boundaryMode,
    iterations: 180,
  };
}

export function createInitialEqualBodyPositions(fixture: RelaxationFixture): Vec3[] {
  validateFixture(fixture);
  const positions: MutableVec3[] = [];
  if (fixture.boundaryMode === "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL") {
    const half = equalVolumeCubeHalfWidth(fixture.reservoirRadius) * 0.965;
    for (let i = 0; i < fixture.particleCount; i += 1) {
      const index = i + 1;
      positions.push([
        half * (2 * halton(index, 2) - 1),
        half * (2 * halton(index, 3) - 1),
        half * (2 * halton(index, 5) - 1),
      ]);
    }
  } else {
    const radius = fixture.reservoirRadius * 0.965;
    for (let i = 0; i < fixture.particleCount; i += 1) {
      const u = (i + 0.5) / fixture.particleCount;
      const radial = radius * Math.cbrt(u);
      const z = 1 - 2 * u;
      const ring = Math.sqrt(Math.max(0, 1 - z * z));
      const phi = GOLDEN_ANGLE * i;
      positions.push([
        radial * ring * Math.cos(phi),
        radial * ring * Math.sin(phi),
        radial * z,
      ]);
    }
  }
  recenter(positions);
  return positions;
}

function recenter(positions: MutableVec3[]): void {
  const centre: MutableVec3 = [0, 0, 0];
  for (const position of positions) addMutable(centre, position);
  const inverse = 1 / positions.length;
  centre[0] *= inverse;
  centre[1] *= inverse;
  centre[2] *= inverse;
  for (const position of positions) {
    position[0] -= centre[0];
    position[1] -= centre[1];
    position[2] -= centre[2];
  }
}

function applyPairAccelerations(positions: readonly Vec3[], accelerations: MutableVec3[], amount: number, softening: number): void {
  const epsilonSquared = softening * softening;
  for (let i = 0; i < positions.length; i += 1) {
    const left = positions[i]!;
    for (let j = i + 1; j < positions.length; j += 1) {
      const right = positions[j]!;
      const dx = left[0] - right[0];
      const dy = left[1] - right[1];
      const dz = left[2] - right[2];
      const denominator = (dx * dx + dy * dy + dz * dz + epsilonSquared) ** 1.5;
      const factor = amount / denominator;
      accelerations[i]![0] += dx * factor;
      accelerations[i]![1] += dy * factor;
      accelerations[i]![2] += dz * factor;
      accelerations[j]![0] -= dx * factor;
      accelerations[j]![1] -= dy * factor;
      accelerations[j]![2] -= dz * factor;
    }
  }
}

function applyBodyAcceleration(position: Vec3, acceleration: MutableVec3, fixture: RelaxationFixture, bodyAmount: number): void {
  if (!(bodyAmount > 0)) return;
  const radius = vectorNorm(position);
  if (radius < 1e-12) return;
  const factor = radius >= fixture.bodyRadius
    ? bodyAmount / radius ** 3
    : bodyAmount / fixture.bodyRadius ** 3;
  acceleration[0] += position[0] * factor;
  acceleration[1] += position[1] * factor;
  acceleration[2] += position[2] * factor;
}

function wallTerm(gap: number, layer: number, strength: number, epsilon: number): number {
  if (gap >= layer) return 0;
  const safeGap = Math.max(0, gap);
  return strength * (1 / (safeGap + epsilon) ** 2 - 1 / (layer + epsilon) ** 2);
}

function applyBoundaryAcceleration(position: Vec3, acceleration: MutableVec3, fixture: RelaxationFixture, spacing: number): void {
  if (fixture.boundaryMode === "ANALYTIC_ISOTROPIC_RESERVOIR") {
    const kappa = FOUR_PI_OVER_THREE * fixture.backgroundDensity;
    acceleration[0] -= kappa * position[0];
    acceleration[1] -= kappa * position[1];
    acceleration[2] -= kappa * position[2];
    return;
  }

  const layer = 1.15 * spacing;
  const epsilon = 0.18 * spacing;
  const strength = 0.55 * spacing ** 2;
  if (fixture.boundaryMode === "SPHERICAL_REPULSIVE_WALL") {
    const radius = vectorNorm(position);
    if (radius < 1e-12) return;
    const magnitude = wallTerm(fixture.reservoirRadius - radius, layer, strength, epsilon);
    acceleration[0] -= magnitude * position[0] / radius;
    acceleration[1] -= magnitude * position[1] / radius;
    acceleration[2] -= magnitude * position[2] / radius;
    return;
  }

  const half = equalVolumeCubeHalfWidth(fixture.reservoirRadius);
  acceleration[0] += wallTerm(half + position[0], layer, strength, epsilon) - wallTerm(half - position[0], layer, strength, epsilon);
  acceleration[1] += wallTerm(half + position[1], layer, strength, epsilon) - wallTerm(half - position[1], layer, strength, epsilon);
  acceleration[2] += wallTerm(half + position[2], layer, strength, epsilon) - wallTerm(half - position[2], layer, strength, epsilon);
}

function enforceDomain(position: MutableVec3, fixture: RelaxationFixture, spacing: number, bodyAmount: number): void {
  const margin = 0.08 * spacing;
  if (bodyAmount > 0) {
    const radius = vectorNorm(position);
    const minimum = fixture.bodyRadius + margin;
    if (radius < minimum) {
      if (radius < 1e-12) {
        position[0] = minimum;
        position[1] = 0;
        position[2] = 0;
      } else {
        const factor = minimum / radius;
        position[0] *= factor;
        position[1] *= factor;
        position[2] *= factor;
      }
    }
  }

  if (fixture.boundaryMode === "SPHERICAL_REPULSIVE_WALL") {
    const maximum = fixture.reservoirRadius - margin;
    const radius = vectorNorm(position);
    if (radius > maximum) {
      const factor = maximum / radius;
      position[0] *= factor;
      position[1] *= factor;
      position[2] *= factor;
    }
  } else if (fixture.boundaryMode === "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL") {
    const maximum = equalVolumeCubeHalfWidth(fixture.reservoirRadius) - margin;
    position[0] = Math.max(-maximum, Math.min(maximum, position[0]));
    position[1] = Math.max(-maximum, Math.min(maximum, position[1]));
    position[2] = Math.max(-maximum, Math.min(maximum, position[2]));
  } else {
    const maximum = fixture.reservoirRadius * 1.25;
    const radius = vectorNorm(position);
    if (radius > maximum) {
      const factor = maximum / radius;
      position[0] *= factor;
      position[1] *= factor;
      position[2] *= factor;
    }
  }
}

function centreResidual(positions: readonly Vec3[]): number {
  const centre: MutableVec3 = [0, 0, 0];
  for (const position of positions) addMutable(centre, position);
  return vectorNorm(scale(centre, 1 / positions.length));
}

function jacobiEigenvalues(matrix: number[][]): [number, number, number] {
  const a = matrix.map((row) => [...row]);
  for (let iteration = 0; iteration < 18; iteration += 1) {
    let p = 0;
    let q = 1;
    let maximum = Math.abs(a[0]![1]!);
    for (const [i, j] of [[0, 2], [1, 2]] as const) {
      const value = Math.abs(a[i]![j]!);
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
  return [a[0]![0]!, a[1]![1]!, a[2]![2]!].sort((left, right) => left - right) as [number, number, number];
}

function anisotropy(positions: readonly Vec3[]): number {
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const position of positions) {
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) matrix[i]![j]! += position[i]! * position[j]!;
    }
  }
  const inverse = 1 / positions.length;
  for (const row of matrix) for (let j = 0; j < 3; j += 1) row[j]! *= inverse;
  const eigenvalues = jacobiEigenvalues(matrix);
  return eigenvalues[0] > 1e-14 ? eigenvalues[2] / eigenvalues[0] - 1 : Number.POSITIVE_INFINITY;
}

function boundaryShellFraction(positions: readonly Vec3[], fixture: RelaxationFixture): number {
  let count = 0;
  if (fixture.boundaryMode === "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL") {
    const half = equalVolumeCubeHalfWidth(fixture.reservoirRadius);
    const threshold = 0.15 * fixture.reservoirRadius;
    for (const position of positions) {
      const gap = Math.min(half - Math.abs(position[0]), half - Math.abs(position[1]), half - Math.abs(position[2]));
      if (gap < threshold) count += 1;
    }
  } else {
    const threshold = 0.85 * fixture.reservoirRadius;
    for (const position of positions) if (vectorNorm(position) > threshold) count += 1;
  }
  return count / positions.length;
}

function densityRows(positions: readonly Vec3[], amount: number, radius: number, bins = 16): { radius: number; density: number }[] {
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
    return { radius: radius * (index + 0.5) / bins, density: value / shellVolume };
  });
}

function bulkDensityRmsError(positions: readonly Vec3[], amount: number, fixture: RelaxationFixture): number {
  const rows = densityRows(positions, amount, fixture.reservoirRadius, 14)
    .filter((row) => row.radius >= 0.2 * fixture.reservoirRadius && row.radius <= 0.6 * fixture.reservoirRadius);
  if (rows.length === 0) return Number.POSITIVE_INFINITY;
  const squared = rows.reduce((sum, row) => sum + ((row.density - fixture.backgroundDensity) / fixture.backgroundDensity) ** 2, 0);
  return Math.sqrt(squared / rows.length);
}

function buildMetrics(
  positions: readonly Vec3[],
  fixture: RelaxationFixture,
  amount: number,
  iterationCount: number,
  finalMeanDisplacement: number,
  finalMaximumDisplacement: number,
  converged: boolean,
): RelaxationMetrics {
  const expectedAmount = fixture.backgroundDensity * containerVolume(fixture);
  const actualAmount = amount * positions.length;
  return {
    converged,
    iterationCount,
    finalMeanDisplacement,
    finalMaximumDisplacement,
    amount: actualAmount,
    amountResidual: actualAmount - expectedAmount,
    centreResidual: centreResidual(positions),
    anisotropy: anisotropy(positions),
    boundaryShellFraction: boundaryShellFraction(positions, fixture),
    minimumRadius: Math.min(...positions.map(vectorNorm)),
    bulkDensityRmsRelativeError: bulkDensityRmsError(positions, amount, fixture),
  };
}

export function relaxEqualBodies(
  initialPositions: readonly Vec3[],
  fixture: RelaxationFixture,
  bodyAmount: number,
): RelaxationState {
  validateFixture(fixture);
  if (initialPositions.length !== fixture.particleCount) throw new Error("initial position count mismatch");
  if (!initialPositions.every(finiteVec)) throw new Error("initial positions must be finite");

  const positions = clonePositions(initialPositions);
  const volume = containerVolume(fixture);
  const totalAmount = fixture.backgroundDensity * volume;
  const amount = totalAmount / fixture.particleCount;
  const spacing = Math.cbrt(volume / fixture.particleCount);
  const softening = 0.32 * spacing;
  const maximumStep = 0.075 * spacing;
  const dt = 0.034;
  const tolerance = 2.5e-4 * spacing;
  let finalMeanDisplacement = Number.POSITIVE_INFINITY;
  let finalMaximumDisplacement = Number.POSITIVE_INFINITY;
  let iterationCount = 0;
  let converged = false;

  for (let iteration = 0; iteration < fixture.iterations; iteration += 1) {
    const accelerations: MutableVec3[] = positions.map(() => [0, 0, 0]);
    applyPairAccelerations(positions, accelerations, amount, softening);
    for (let i = 0; i < positions.length; i += 1) {
      applyBodyAcceleration(positions[i]!, accelerations[i]!, fixture, bodyAmount);
      applyBoundaryAcceleration(positions[i]!, accelerations[i]!, fixture, spacing);
    }

    let displacementSum = 0;
    let displacementMaximum = 0;
    for (let i = 0; i < positions.length; i += 1) {
      const acceleration = accelerations[i]!;
      const raw: MutableVec3 = [dt * acceleration[0], dt * acceleration[1], dt * acceleration[2]];
      const magnitude = vectorNorm(raw);
      if (magnitude > maximumStep) {
        const factor = maximumStep / magnitude;
        raw[0] *= factor;
        raw[1] *= factor;
        raw[2] *= factor;
      }
      positions[i]![0] += raw[0];
      positions[i]![1] += raw[1];
      positions[i]![2] += raw[2];
      enforceDomain(positions[i]!, fixture, spacing, bodyAmount);
      const displacement = vectorNorm(raw);
      displacementSum += displacement;
      displacementMaximum = Math.max(displacementMaximum, displacement);
    }
    recenter(positions);
    for (const position of positions) enforceDomain(position, fixture, spacing, bodyAmount);
    finalMeanDisplacement = displacementSum / positions.length;
    finalMaximumDisplacement = displacementMaximum;
    iterationCount = iteration + 1;
    if (iteration >= 40 && finalMeanDisplacement < tolerance && finalMaximumDisplacement < 4 * tolerance) {
      converged = true;
      break;
    }
  }

  return {
    positions,
    particleAmount: amount,
    metrics: buildMetrics(
      positions,
      fixture,
      amount,
      iterationCount,
      finalMeanDisplacement,
      finalMaximumDisplacement,
      converged,
    ),
  };
}

function smooth(values: readonly number[]): number[] {
  return values.map((value, index) => {
    let sum = value;
    let count = 1;
    if (index > 0) {
      sum += values[index - 1]!;
      count += 1;
    }
    if (index + 1 < values.length) {
      sum += values[index + 1]!;
      count += 1;
    }
    return sum / count;
  });
}

function thresholdRadius(rows: readonly RadialRelaxationRow[], threshold: number, minimumRadius: number): number | null {
  const ratios = smooth(rows.map((row) => row.c1ToC0Ratio));
  let seenBelow = false;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (row.radius < minimumRadius) continue;
    const ratio = ratios[i]!;
    if (ratio < threshold) seenBelow = true;
    if (seenBelow && ratio >= threshold) return row.radius;
  }
  return null;
}

export function buildGeneratedCavityResult(fixture: RelaxationFixture): GeneratedCavityResult {
  const initial = createInitialEqualBodyPositions(fixture);
  const c0 = relaxEqualBodies(initial, fixture, 0);
  const c1 = relaxEqualBodies(c0.positions, fixture, fixture.bodyAmount);
  const c0Rows = densityRows(c0.positions, c0.particleAmount, fixture.reservoirRadius, 24);
  const c1Rows = densityRows(c1.positions, c1.particleAmount, fixture.reservoirRadius, 24);
  const radialProfile = c0Rows.map((row, index) => {
    const c1Density = c1Rows[index]!.density;
    return {
      radius: row.radius,
      c0Density: row.density,
      c1Density,
      c1ToC0Ratio: row.density > 1e-12 ? c1Density / row.density : 1,
    };
  });
  const farRows = radialProfile.filter((row) => row.radius >= 0.55 * fixture.reservoirRadius && row.radius <= 0.72 * fixture.reservoirRadius);
  const farBulkDensity = farRows.length > 0
    ? farRows.reduce((sum, row) => sum + row.c1Density, 0) / farRows.length
    : fixture.backgroundDensity;
  const relevant = radialProfile.filter((row) => row.radius >= fixture.bodyRadius && row.radius <= 0.55 * fixture.reservoirRadius);
  const minimumDensityRatio = relevant.length > 0 ? Math.min(...relevant.map((row) => row.c1ToC0Ratio)) : 1;
  const backgroundAmountResidual = c1.metrics.amount - c0.metrics.amount;
  return {
    fixture,
    c0,
    c1,
    radialProfile,
    cavity: {
      farBulkDensity,
      minimumDensityRatio,
      cavityRadius50: thresholdRadius(radialProfile, 0.5, fixture.bodyRadius),
      cavityRadius90: thresholdRadius(radialProfile, 0.9, fixture.bodyRadius),
      backgroundAmountResidual,
      nearestBackgroundRadius: c1.metrics.minimumRadius,
    },
  };
}

function samplePointBodies(probe: Vec3, positions: readonly Vec3[], amount: number, softening: number): FieldSample {
  let w0 = 0;
  const w1: MutableVec3 = [0, 0, 0];
  const epsilonSquared = softening * softening;
  for (const position of positions) {
    const delta = subtract(position, probe);
    const squared = delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2 + epsilonSquared;
    w0 += amount / squared;
    const factor = amount / squared ** 1.5;
    w1[0] += delta[0] * factor;
    w1[1] += delta[1] * factor;
    w1[2] += delta[2] * factor;
  }
  return { w0, w1, w1Magnitude: vectorNorm(w1) };
}

function sampleUniformBody(probe: Vec3, fixture: RelaxationFixture): FieldSample {
  const distance = vectorNorm(probe);
  if (distance < 1e-12) return {
    w0: 3 * fixture.bodyAmount / fixture.bodyRadius ** 2,
    w1: [0, 0, 0],
    w1Magnitude: 0,
  };
  const direction = scale(probe, -1 / distance);
  if (distance >= fixture.bodyRadius) {
    const magnitude = fixture.bodyAmount / distance ** 2;
    return { w0: magnitude, w1: scale(direction, magnitude), w1Magnitude: magnitude };
  }
  const magnitude = fixture.bodyAmount * distance / fixture.bodyRadius ** 3;
  return {
    w0: 3 * fixture.bodyAmount / fixture.bodyRadius ** 2 - fixture.bodyAmount * distance ** 2 / fixture.bodyRadius ** 4,
    w1: scale(direction, magnitude),
    w1Magnitude: magnitude,
  };
}

export function sampleGeneratedPoint(probe: Vec3, result: GeneratedCavityResult): GeneratedPointSample {
  const spacing = Math.cbrt(containerVolume(result.fixture) / result.fixture.particleCount);
  const softening = 0.20 * spacing;
  const c0Background = samplePointBodies(probe, result.c0.positions, result.c0.particleAmount, softening);
  const c1Background = samplePointBodies(probe, result.c1.positions, result.c1.particleAmount, softening);
  const body = sampleUniformBody(probe, result.fixture);
  const backgroundVector = subtract(c1Background.w1, c0Background.w1);
  const fullVector: MutableVec3 = [
    body.w1[0] + backgroundVector[0],
    body.w1[1] + backgroundVector[1],
    body.w1[2] + backgroundVector[2],
  ];
  return {
    c0Background,
    c1Background,
    body,
    backgroundDelta: {
      w0: c1Background.w0 - c0Background.w0,
      w1: backgroundVector,
      w1Magnitude: vectorNorm(backgroundVector),
    },
    fullDelta: {
      w0: body.w0 + c1Background.w0 - c0Background.w0,
      w1: fullVector,
      w1Magnitude: vectorNorm(fullVector),
    },
  };
}

export function compareBoundaryResults(results: readonly GeneratedCavityResult[]): BoundaryGateSummary {
  const thresholds = {
    analyticC0BulkRmsMaximum: 0.35,
    generatedCavityMinimumRadiusFactor: 1.05,
    boundaryRobustRelativeSpreadMaximum: 0.20,
  };
  const rows = results.map((result): BoundaryComparisonRow => ({
    boundaryMode: result.fixture.boundaryMode,
    c0BulkDensityError: result.c0.metrics.bulkDensityRmsRelativeError,
    c0Anisotropy: result.c0.metrics.anisotropy,
    c0BoundaryShellFraction: result.c0.metrics.boundaryShellFraction,
    c1CavityRadius50: result.cavity.cavityRadius50,
    c1CavityRadius90: result.cavity.cavityRadius90,
    c1MinimumDensityRatio: result.cavity.minimumDensityRatio,
    c1NearestBackgroundRadius: result.cavity.nearestBackgroundRadius,
    c0Converged: result.c0.metrics.converged,
    c1Converged: result.c1.metrics.converged,
  }));
  const finite = rows.every((row) => Object.values(row).every((value) => value === null || typeof value === "boolean" || typeof value === "string" || Number.isFinite(value)));
  if (!finite || results.length !== 3) {
    return { verdict: "C0_C1_NUMERICAL_OR_PROVENANCE_BLOCKER", rows, cavityRadius50RelativeSpread: null, thresholds };
  }
  const analytic = rows.find((row) => row.boundaryMode === "ANALYTIC_ISOTROPIC_RESERVOIR");
  if (!analytic || analytic.c0BulkDensityError > thresholds.analyticC0BulkRmsMaximum) {
    return { verdict: "C0_UNIFORM_BACKGROUND_NOT_OBTAINED", rows, cavityRadius50RelativeSpread: null, thresholds };
  }
  const generated = rows.filter((row) => row.c1CavityRadius50 !== null && row.c1CavityRadius50 > defaultRelaxationFixture().bodyRadius * thresholds.generatedCavityMinimumRadiusFactor);
  if (!generated.some((row) => row.boundaryMode === "ANALYTIC_ISOTROPIC_RESERVOIR")) {
    return { verdict: "C1_NO_GENERATED_CAVITY", rows, cavityRadius50RelativeSpread: null, thresholds };
  }
  const radii = rows.map((row) => row.c1CavityRadius50).filter((value): value is number => value !== null);
  const mean = radii.reduce((sum, value) => sum + value, 0) / Math.max(1, radii.length);
  const spread = radii.length === rows.length && mean > 0 ? (Math.max(...radii) - Math.min(...radii)) / mean : null;
  const allC0Acceptable = rows.every((row) => row.c0BulkDensityError <= thresholds.analyticC0BulkRmsMaximum);
  const robust = generated.length === rows.length && allC0Acceptable && spread !== null && spread <= thresholds.boundaryRobustRelativeSpreadMaximum;
  return {
    verdict: robust ? "C0_C1_GENERATED_CAVITY_BOUNDARY_ROBUST_PASS" : "C0_C1_CAVITY_GENERATED_BUT_BOUNDARY_DEPENDENT",
    rows,
    cavityRadius50RelativeSpread: spread,
    thresholds,
  };
}
