import { fibonacciDirections } from "./firstHitContinuousColumn";
import { analyticSphereOutside, vectorNorm, type Vec3 } from "./math";

export type ProjectionMode =
  | "TRANSPARENT_FULL_COLUMN"
  | "FIRST_REGISTERED_OWNER_COLUMN";

export type ContinuousFieldSourceClass =
  | "SYNTHETIC_ORACLE"
  | "FROZEN_V5"
  | "FROZEN_V6"
  | "FROZEN_V14";

export type Mat3 = readonly [Vec3, Vec3, Vec3];

export interface ContinuousFieldSnapshotV1 {
  schema: "VOXELLAB_CONTINUOUS_FIELD_SNAPSHOT_V1";
  snapshotId: string;
  sourceClass: ContinuousFieldSourceClass;
  origin: Vec3;
  spacing: Vec3;
  dimensions: readonly [number, number, number];
  rho: readonly number[];
  ownerIds?: readonly number[];
  provenance: {
    sourceCommit: string;
    sourcePacketSha256: string | null;
    claimCeiling: string;
  };
}

export interface SnapshotValidationResult {
  valid: boolean;
  errors: string[];
  voxelCount: number;
  totalPositiveAmount: number;
  hasOwnerIds: boolean;
}

export interface ContinuousFieldColumnCell {
  index: number;
  direction: Vec3;
  solidAngle: number;
  entry: number | null;
  exit: number | null;
  firstOwnerId: number | null;
  columnDensity: number;
  actionContribution: number;
}

export interface MultipolePowers {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
}

export interface ContinuousFieldActionReadout {
  schema: "VOXELLAB_A4_CONTINUOUS_FIELD_ACTION_READOUT_V1";
  snapshotId: string;
  sourceClass: ContinuousFieldSourceClass;
  projectionMode: ProjectionMode;
  receiver: Vec3;
  directionCount: number;
  stepLength: number;
  w0: number;
  w1: Vec3;
  w1Magnitude: number;
  w2: Mat3;
  traceClosureAbsolute: number;
  traceClosureRelative: number;
  normalizedDeviatoricW2: number;
  multipoles: MultipolePowers;
  openDirectionCount: number;
  coverageFraction: number;
  firstOwnerDirectionCounts: Record<string, number>;
  cells: ContinuousFieldColumnCell[];
}

export interface SignedActionMoment {
  w0: number;
  w1: Vec3;
  w1Magnitude: number;
  w2: Mat3;
}

export interface ProjectionDecomposition {
  fullColumn: ContinuousFieldActionReadout;
  firstOwnerColumn: ContinuousFieldActionReadout;
  complementarySignedDiagnostic: SignedActionMoment;
  interpretation: "SIGNED_READOUT_DIFFERENCE_NOT_NEGATIVE_MATTER";
}

export interface ActionCurlEstimate {
  curl: Vec3;
  curlMagnitude: number;
  normalizedCurl: number;
  sampleSpacing: number;
  meanNeighbourW1Magnitude: number;
}

export interface ActionReferenceComparison {
  referenceVector: Vec3;
  readoutVector: Vec3;
  cosineAlignment: number | null;
  bestScalarCoefficient: number | null;
  bestScaledRelativeResidual: number | null;
}

export interface SyntheticBridgeFixture {
  id: "UNIFORM_SPHERE" | "TWO_OWNER_COLUMN";
  snapshot: ContinuousFieldSnapshotV1;
  receiver: Vec3;
  analyticSphere: { radius: number; density: number } | null;
  note: string;
}

export interface A4MethodGate {
  id: string;
  label: string;
  value: number;
  threshold: number;
  comparison: "MAX";
  pass: boolean;
}

export interface A4MethodGateReceipt {
  schema: "VOXELLAB_A4_V14_CONTINUOUS_FIELD_ACTION_BRIDGE_GATE_V1";
  methodVerdict:
    | "A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_PASS"
    | "A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_BLOCKER";
  overallVerdict:
    | "A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER"
    | "A4_METHOD_BRIDGE_NUMERICAL_BLOCKER";
  snapshotExportStatus: "NO_FROZEN_V5_V6_V14_RHO_SNAPSHOT_ATTACHED";
  gates: A4MethodGate[];
  oracle: {
    directionCount: number;
    resolution: number;
    transparentW0RelativeError: number;
    transparentW1RelativeError: number;
    firstOwnerW0RelativeDelta: number;
    firstOwnerW1RelativeDelta: number;
    rotationW0RelativeDelta: number;
    rotationW1RelativeDelta: number;
    traceClosureRelative: number;
    normalizedCurl: number;
  };
  claimCeiling: string;
  firewalls: string[];
}

export interface ProjectionOptions {
  directionCount?: number;
  stepLength?: number;
  minimumColumn?: number;
}

type MutableVec3 = [number, number, number];
type MutableMat3 = [MutableVec3, MutableVec3, MutableVec3];

const FOUR_PI = 4 * Math.PI;
const SOURCE_CLASSES = new Set<ContinuousFieldSourceClass>([
  "SYNTHETIC_ORACLE",
  "FROZEN_V5",
  "FROZEN_V6",
  "FROZEN_V14",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteVec3(value: unknown): value is Vec3 {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function isIntegerDimensions(value: unknown): value is readonly [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && value.every((entry) => Number.isInteger(entry) && Number(entry) >= 2);
}

function expectedVoxelCount(dimensions: readonly [number, number, number]): number {
  return dimensions[0] * dimensions[1] * dimensions[2];
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function vectorAdd(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function vectorSubtract(left: Vec3, right: Vec3): Vec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function vectorScale(value: Vec3, factor: number): Vec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function vectorDot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function relativeError(value: number, reference: number): number {
  if (reference === 0) return value === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(value - reference) / Math.abs(reference);
}

function emptyMatrix(): MutableMat3 {
  return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
}

function addOuterProduct(target: MutableMat3, direction: Vec3, weight: number): void {
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      target[row]![column]! += direction[row]! * direction[column]! * weight;
    }
  }
}

function freezeMatrix(value: MutableMat3): Mat3 {
  return [
    [value[0][0], value[0][1], value[0][2]],
    [value[1][0], value[1][1], value[1][2]],
    [value[2][0], value[2][1], value[2][2]],
  ];
}

function subtractMatrices(left: Mat3, right: Mat3): Mat3 {
  return [
    [left[0][0] - right[0][0], left[0][1] - right[0][1], left[0][2] - right[0][2]],
    [left[1][0] - right[1][0], left[1][1] - right[1][1], left[1][2] - right[1][2]],
    [left[2][0] - right[2][0], left[2][1] - right[2][1], left[2][2] - right[2][2]],
  ];
}

function matrixFrobenius(value: Mat3): number {
  let sum = 0;
  for (const row of value) for (const entry of row) sum += entry ** 2;
  return Math.sqrt(sum);
}

export function validateContinuousFieldSnapshot(snapshot: ContinuousFieldSnapshotV1): SnapshotValidationResult {
  const errors: string[] = [];
  if (snapshot.schema !== "VOXELLAB_CONTINUOUS_FIELD_SNAPSHOT_V1") {
    errors.push("schema must be VOXELLAB_CONTINUOUS_FIELD_SNAPSHOT_V1");
  }
  if (typeof snapshot.snapshotId !== "string" || snapshot.snapshotId.trim().length === 0) {
    errors.push("snapshotId must be a non-empty string");
  }
  if (!SOURCE_CLASSES.has(snapshot.sourceClass)) errors.push("sourceClass is not registered");
  if (!isFiniteVec3(snapshot.origin)) errors.push("origin must contain three finite numbers");
  if (!isFiniteVec3(snapshot.spacing) || !snapshot.spacing.every((entry) => entry > 0)) {
    errors.push("spacing must contain three positive finite numbers");
  }
  if (!isIntegerDimensions(snapshot.dimensions)) {
    errors.push("dimensions must contain three integers >= 2");
  }

  const voxelCount = isIntegerDimensions(snapshot.dimensions)
    ? expectedVoxelCount(snapshot.dimensions)
    : 0;
  if (!Array.isArray(snapshot.rho) || snapshot.rho.length !== voxelCount) {
    errors.push(`rho length must equal voxel count ${voxelCount}`);
  }
  let totalPositiveAmount = 0;
  if (Array.isArray(snapshot.rho)) {
    const voxelVolume = isFiniteVec3(snapshot.spacing)
      ? snapshot.spacing[0] * snapshot.spacing[1] * snapshot.spacing[2]
      : 0;
    for (const value of snapshot.rho) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        errors.push("rho must contain only finite non-negative values");
        break;
      }
      totalPositiveAmount += value * voxelVolume;
    }
  }

  if (snapshot.ownerIds !== undefined) {
    if (!Array.isArray(snapshot.ownerIds) || snapshot.ownerIds.length !== voxelCount) {
      errors.push(`ownerIds length must equal voxel count ${voxelCount}`);
    } else if (!snapshot.ownerIds.every((value) => Number.isInteger(value) && value >= 0)) {
      errors.push("ownerIds must contain only non-negative integers");
    }
  }

  if (!isRecord(snapshot.provenance)) {
    errors.push("provenance must be present");
  } else {
    if (typeof snapshot.provenance.sourceCommit !== "string" || snapshot.provenance.sourceCommit.length === 0) {
      errors.push("provenance.sourceCommit must be present");
    }
    if (snapshot.provenance.sourcePacketSha256 !== null
      && (typeof snapshot.provenance.sourcePacketSha256 !== "string"
        || !/^[0-9a-f]{64}$/i.test(snapshot.provenance.sourcePacketSha256))) {
      errors.push("provenance.sourcePacketSha256 must be null or a complete SHA256");
    }
    if (typeof snapshot.provenance.claimCeiling !== "string"
      || snapshot.provenance.claimCeiling.trim().length === 0) {
      errors.push("provenance.claimCeiling must be present");
    }
  }

  if (snapshot.sourceClass !== "SYNTHETIC_ORACLE") {
    if (!/^[0-9a-f]{40}$/i.test(snapshot.provenance?.sourceCommit ?? "")) {
      errors.push("frozen snapshots require a complete 40-character source commit");
    }
    if (!/^[0-9a-f]{64}$/i.test(snapshot.provenance?.sourcePacketSha256 ?? "")) {
      errors.push("frozen snapshots require a complete source packet SHA256");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    voxelCount,
    totalPositiveAmount,
    hasOwnerIds: snapshot.ownerIds !== undefined,
  };
}

export function parseContinuousFieldSnapshot(value: unknown): ContinuousFieldSnapshotV1 {
  if (!isRecord(value)) throw new Error("A4 snapshot JSON must contain an object");
  const candidate = value as unknown as ContinuousFieldSnapshotV1;
  const validation = validateContinuousFieldSnapshot(candidate);
  if (!validation.valid) throw new Error(`A4 snapshot contract rejected: ${validation.errors.join("; ")}`);
  return candidate;
}

function requireValidSnapshot(snapshot: ContinuousFieldSnapshotV1): SnapshotValidationResult {
  const validation = validateContinuousFieldSnapshot(snapshot);
  if (!validation.valid) throw new Error(`Invalid continuous-field snapshot: ${validation.errors.join("; ")}`);
  return validation;
}

function gridIndex(
  snapshot: ContinuousFieldSnapshotV1,
  ix: number,
  iy: number,
  iz: number,
): number {
  const [nx, ny] = snapshot.dimensions;
  return ix + nx * (iy + ny * iz);
}

function gridCoordinates(snapshot: ContinuousFieldSnapshotV1, point: Vec3): Vec3 {
  return [
    (point[0] - snapshot.origin[0]) / snapshot.spacing[0],
    (point[1] - snapshot.origin[1]) / snapshot.spacing[1],
    (point[2] - snapshot.origin[2]) / snapshot.spacing[2],
  ];
}

export function sampleContinuousRho(snapshot: ContinuousFieldSnapshotV1, point: Vec3): number {
  const [gx, gy, gz] = gridCoordinates(snapshot, point);
  const [nx, ny, nz] = snapshot.dimensions;
  if (gx < 0 || gy < 0 || gz < 0 || gx > nx - 1 || gy > ny - 1 || gz > nz - 1) return 0;

  const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
  const x1 = Math.min(nx - 1, x0 + 1);
  const y1 = Math.min(ny - 1, y0 + 1);
  const z1 = Math.min(nz - 1, z0 + 1);
  const tx = gx - x0, ty = gy - y0, tz = gz - z0;

  const value = (ix: number, iy: number, iz: number) => snapshot.rho[gridIndex(snapshot, ix, iy, iz)] ?? 0;
  const c00 = value(x0, y0, z0) * (1 - tx) + value(x1, y0, z0) * tx;
  const c10 = value(x0, y1, z0) * (1 - tx) + value(x1, y1, z0) * tx;
  const c01 = value(x0, y0, z1) * (1 - tx) + value(x1, y0, z1) * tx;
  const c11 = value(x0, y1, z1) * (1 - tx) + value(x1, y1, z1) * tx;
  const c0 = c00 * (1 - ty) + c10 * ty;
  const c1 = c01 * (1 - ty) + c11 * ty;
  return c0 * (1 - tz) + c1 * tz;
}

export function sampleContinuousOwner(snapshot: ContinuousFieldSnapshotV1, point: Vec3): number {
  if (!snapshot.ownerIds) return 0;
  const [gx, gy, gz] = gridCoordinates(snapshot, point);
  const [nx, ny, nz] = snapshot.dimensions;
  if (gx < 0 || gy < 0 || gz < 0 || gx > nx - 1 || gy > ny - 1 || gz > nz - 1) return 0;

  const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
  const x1 = Math.min(nx - 1, x0 + 1);
  const y1 = Math.min(ny - 1, y0 + 1);
  const z1 = Math.min(nz - 1, z0 + 1);
  const tx = gx - x0, ty = gy - y0, tz = gz - z0;
  const candidates = new Map<number, number>();
  const xs = [[x0, 1 - tx], [x1, tx]] as const;
  const ys = [[y0, 1 - ty], [y1, ty]] as const;
  const zs = [[z0, 1 - tz], [z1, tz]] as const;
  for (const [ix, wx] of xs) for (const [iy, wy] of ys) for (const [iz, wz] of zs) {
    const index = gridIndex(snapshot, ix, iy, iz);
    const ownerId = snapshot.ownerIds[index] ?? 0;
    const density = snapshot.rho[index] ?? 0;
    const contribution = wx * wy * wz * density;
    if (contribution > 0) {
      candidates.set(ownerId, (candidates.get(ownerId) ?? 0) + contribution);
    }
  }
  let selected = 0;
  let maximum = 0;
  for (const [ownerId, contribution] of candidates) {
    if (contribution > maximum) {
      selected = ownerId;
      maximum = contribution;
    }
  }
  return selected;
}

function snapshotBounds(snapshot: ContinuousFieldSnapshotV1): readonly [Vec3, Vec3] {
  return [
    snapshot.origin,
    [
      snapshot.origin[0] + snapshot.spacing[0] * (snapshot.dimensions[0] - 1),
      snapshot.origin[1] + snapshot.spacing[1] * (snapshot.dimensions[1] - 1),
      snapshot.origin[2] + snapshot.spacing[2] * (snapshot.dimensions[2] - 1),
    ],
  ];
}

export function raySnapshotInterval(
  snapshot: ContinuousFieldSnapshotV1,
  origin: Vec3,
  direction: Vec3,
): readonly [number, number] | null {
  const magnitude = vectorNorm(direction);
  if (!(magnitude > 0)) throw new Error("A4 ray direction must be nonzero");
  const unit = vectorScale(direction, 1 / magnitude);
  const [minimum, maximum] = snapshotBounds(snapshot);
  let near = 0;
  let far = Number.POSITIVE_INFINITY;

  for (let axis = 0; axis < 3; axis += 1) {
    const component = unit[axis]!;
    const coordinate = origin[axis]!;
    const lower = minimum[axis]!;
    const upper = maximum[axis]!;
    if (Math.abs(component) < 1e-14) {
      if (coordinate < lower || coordinate > upper) return null;
      continue;
    }
    let left = (lower - coordinate) / component;
    let right = (upper - coordinate) / component;
    if (left > right) [left, right] = [right, left];
    near = Math.max(near, left);
    far = Math.min(far, right);
    if (far <= near) return null;
  }
  return far > 0 ? [Math.max(0, near), far] : null;
}

function factorial(value: number): number {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function associatedLegendre(degree: number, order: number, x: number): number {
  let pmm = 1;
  if (order > 0) {
    const root = Math.sqrt(Math.max(0, 1 - x ** 2));
    let factor = 1;
    for (let index = 1; index <= order; index += 1) {
      pmm *= -factor * root;
      factor += 2;
    }
  }
  if (degree === order) return pmm;
  let previous = pmm;
  let current = x * (2 * order + 1) * pmm;
  if (degree === order + 1) return current;
  for (let ell = order + 2; ell <= degree; ell += 1) {
    const next = ((2 * ell - 1) * x * current - (ell + order - 1) * previous) / (ell - order);
    previous = current;
    current = next;
  }
  return current;
}

function weightedMultipolePower(
  cells: readonly ContinuousFieldColumnCell[],
  degree: number,
  w0: number,
): number {
  if (!(w0 > 0)) return 0;
  const coefficients: number[] = [];
  const zeroNorm = Math.sqrt((2 * degree + 1) / FOUR_PI);
  let m0 = 0;
  for (const cell of cells) {
    if (!(cell.actionContribution > 0)) continue;
    m0 += cell.actionContribution * zeroNorm
      * associatedLegendre(degree, 0, cell.direction[2]);
  }
  coefficients.push(m0 / w0);

  for (let order = 1; order <= degree; order += 1) {
    const normalization = Math.sqrt(2) * Math.sqrt(
      (2 * degree + 1) / FOUR_PI
      * factorial(degree - order) / factorial(degree + order),
    );
    let cosineCoefficient = 0;
    let sineCoefficient = 0;
    for (const cell of cells) {
      if (!(cell.actionContribution > 0)) continue;
      const phi = Math.atan2(cell.direction[1], cell.direction[0]);
      const basis = normalization * associatedLegendre(degree, order, cell.direction[2]);
      cosineCoefficient += cell.actionContribution * basis * Math.cos(order * phi);
      sineCoefficient += cell.actionContribution * basis * Math.sin(order * phi);
    }
    coefficients.push(cosineCoefficient / w0, sineCoefficient / w0);
  }
  return Math.sqrt(coefficients.reduce((sum, value) => sum + value ** 2, 0)) * Math.sqrt(FOUR_PI);
}

function computeMultipoles(cells: readonly ContinuousFieldColumnCell[], w0: number): MultipolePowers {
  return {
    p1: weightedMultipolePower(cells, 1, w0),
    p2: weightedMultipolePower(cells, 2, w0),
    p3: weightedMultipolePower(cells, 3, w0),
    p4: weightedMultipolePower(cells, 4, w0),
  };
}

export function integrateContinuousFieldColumns(
  snapshot: ContinuousFieldSnapshotV1,
  receiver: Vec3,
  projectionMode: ProjectionMode,
  options: ProjectionOptions = {},
): ContinuousFieldActionReadout {
  requireValidSnapshot(snapshot);
  if (!isFiniteVec3(receiver)) throw new Error("A4 receiver must contain three finite numbers");
  if (projectionMode === "FIRST_REGISTERED_OWNER_COLUMN" && !snapshot.ownerIds) {
    throw new Error("FIRST_REGISTERED_OWNER_COLUMN requires ownerIds from the source solver");
  }

  const directionCount = options.directionCount ?? 8192;
  if (!Number.isInteger(directionCount) || directionCount < 256) {
    throw new Error("A4 directionCount must be an integer >= 256");
  }
  const minimumSpacing = Math.min(...snapshot.spacing);
  const stepLength = options.stepLength ?? 0.5 * minimumSpacing;
  if (!finitePositive(stepLength)) throw new Error("A4 stepLength must be positive");
  const minimumColumn = options.minimumColumn ?? 1e-14;
  if (!Number.isFinite(minimumColumn) || minimumColumn < 0) {
    throw new Error("A4 minimumColumn must be finite and non-negative");
  }

  const directions = fibonacciDirections(directionCount);
  const solidAngle = FOUR_PI / directionCount;
  const cells: ContinuousFieldColumnCell[] = [];
  const firstOwnerDirectionCounts: Record<string, number> = {};
  const w2 = emptyMatrix();
  let w0 = 0;
  let w1: MutableVec3 = [0, 0, 0];
  let openDirectionCount = 0;

  directions.forEach((direction, index) => {
    const interval = raySnapshotInterval(snapshot, receiver, direction);
    if (!interval) {
      openDirectionCount += 1;
      cells.push({
        index,
        direction,
        solidAngle,
        entry: null,
        exit: null,
        firstOwnerId: null,
        columnDensity: 0,
        actionContribution: 0,
      });
      return;
    }

    const length = interval[1] - interval[0];
    const stepCount = Math.max(1, Math.ceil(length / stepLength));
    const ds = length / stepCount;
    let firstOwnerId: number | null = null;
    let columnDensity = 0;
    for (let step = 0; step < stepCount; step += 1) {
      const distance = interval[0] + (step + 0.5) * ds;
      const point: Vec3 = [
        receiver[0] + direction[0] * distance,
        receiver[1] + direction[1] * distance,
        receiver[2] + direction[2] * distance,
      ];
      const rho = sampleContinuousRho(snapshot, point);
      if (!(rho > 0)) continue;
      const ownerId = sampleContinuousOwner(snapshot, point);
      if (firstOwnerId === null && ownerId > 0) firstOwnerId = ownerId;
      if (projectionMode === "TRANSPARENT_FULL_COLUMN"
        || (firstOwnerId !== null && ownerId === firstOwnerId)) {
        columnDensity += rho * ds;
      }
    }

    const actionContribution = columnDensity * solidAngle;
    if (!(actionContribution > minimumColumn)) {
      openDirectionCount += 1;
    } else {
      w0 += actionContribution;
      w1[0] += direction[0] * actionContribution;
      w1[1] += direction[1] * actionContribution;
      w1[2] += direction[2] * actionContribution;
      addOuterProduct(w2, direction, actionContribution);
    }
    if (firstOwnerId !== null) {
      const key = String(firstOwnerId);
      firstOwnerDirectionCounts[key] = (firstOwnerDirectionCounts[key] ?? 0) + 1;
    }
    cells.push({
      index,
      direction,
      solidAngle,
      entry: interval[0],
      exit: interval[1],
      firstOwnerId,
      columnDensity,
      actionContribution,
    });
  });

  const frozenW2 = freezeMatrix(w2);
  const trace = frozenW2[0][0] + frozenW2[1][1] + frozenW2[2][2];
  const traceClosureAbsolute = Math.abs(trace - w0);
  const traceClosureRelative = traceClosureAbsolute / Math.max(Math.abs(w0), 1e-30);
  const isotropic = trace / 3;
  const deviator: Mat3 = [
    [frozenW2[0][0] - isotropic, frozenW2[0][1], frozenW2[0][2]],
    [frozenW2[1][0], frozenW2[1][1] - isotropic, frozenW2[1][2]],
    [frozenW2[2][0], frozenW2[2][1], frozenW2[2][2] - isotropic],
  ];

  return {
    schema: "VOXELLAB_A4_CONTINUOUS_FIELD_ACTION_READOUT_V1",
    snapshotId: snapshot.snapshotId,
    sourceClass: snapshot.sourceClass,
    projectionMode,
    receiver,
    directionCount,
    stepLength,
    w0,
    w1,
    w1Magnitude: vectorNorm(w1),
    w2: frozenW2,
    traceClosureAbsolute,
    traceClosureRelative,
    normalizedDeviatoricW2: matrixFrobenius(deviator) / Math.max(Math.abs(w0), 1e-30),
    multipoles: computeMultipoles(cells, w0),
    openDirectionCount,
    coverageFraction: 1 - openDirectionCount / directionCount,
    firstOwnerDirectionCounts,
    cells,
  };
}

export function signedReadoutDifference(
  left: ContinuousFieldActionReadout,
  right: ContinuousFieldActionReadout,
): SignedActionMoment {
  const w1 = vectorSubtract(left.w1, right.w1);
  return {
    w0: left.w0 - right.w0,
    w1,
    w1Magnitude: vectorNorm(w1),
    w2: subtractMatrices(left.w2, right.w2),
  };
}

export function buildProjectionDecomposition(
  snapshot: ContinuousFieldSnapshotV1,
  receiver: Vec3,
  options: ProjectionOptions = {},
): ProjectionDecomposition {
  if (!snapshot.ownerIds) throw new Error("A4 projection decomposition requires source-exported ownerIds");
  const fullColumn = integrateContinuousFieldColumns(
    snapshot,
    receiver,
    "TRANSPARENT_FULL_COLUMN",
    options,
  );
  const firstOwnerColumn = integrateContinuousFieldColumns(
    snapshot,
    receiver,
    "FIRST_REGISTERED_OWNER_COLUMN",
    options,
  );
  return {
    fullColumn,
    firstOwnerColumn,
    complementarySignedDiagnostic: signedReadoutDifference(fullColumn, firstOwnerColumn),
    interpretation: "SIGNED_READOUT_DIFFERENCE_NOT_NEGATIVE_MATTER",
  };
}

export function estimateActionCurl(
  snapshot: ContinuousFieldSnapshotV1,
  receiver: Vec3,
  sampleSpacing: number,
  projectionMode: ProjectionMode,
  options: ProjectionOptions = {},
): ActionCurlEstimate {
  if (!finitePositive(sampleSpacing)) throw new Error("A4 curl sampleSpacing must be positive");
  const offsets: Vec3[] = [
    [sampleSpacing, 0, 0],
    [-sampleSpacing, 0, 0],
    [0, sampleSpacing, 0],
    [0, -sampleSpacing, 0],
    [0, 0, sampleSpacing],
    [0, 0, -sampleSpacing],
  ];
  const samples = offsets.map((offset) => integrateContinuousFieldColumns(
    snapshot,
    vectorAdd(receiver, offset),
    projectionMode,
    options,
  ));
  const xp = samples[0]!, xm = samples[1]!;
  const yp = samples[2]!, ym = samples[3]!;
  const zp = samples[4]!, zm = samples[5]!;
  const inverse = 1 / (2 * sampleSpacing);
  const dFzDy = (yp.w1[2] - ym.w1[2]) * inverse;
  const dFyDz = (zp.w1[1] - zm.w1[1]) * inverse;
  const dFxDz = (zp.w1[0] - zm.w1[0]) * inverse;
  const dFzDx = (xp.w1[2] - xm.w1[2]) * inverse;
  const dFyDx = (xp.w1[1] - xm.w1[1]) * inverse;
  const dFxDy = (yp.w1[0] - ym.w1[0]) * inverse;
  const curl: Vec3 = [
    dFzDy - dFyDz,
    dFxDz - dFzDx,
    dFyDx - dFxDy,
  ];
  const meanNeighbourW1Magnitude = samples.reduce(
    (sum, sample) => sum + sample.w1Magnitude,
    0,
  ) / samples.length;
  const curlMagnitude = vectorNorm(curl);
  return {
    curl,
    curlMagnitude,
    normalizedCurl: curlMagnitude * sampleSpacing / Math.max(meanNeighbourW1Magnitude, 1e-30),
    sampleSpacing,
    meanNeighbourW1Magnitude,
  };
}

export function compareActionMomentToReference(
  readout: ContinuousFieldActionReadout,
  referenceVector: Vec3,
): ActionReferenceComparison {
  const readoutMagnitude = readout.w1Magnitude;
  const referenceMagnitude = vectorNorm(referenceVector);
  if (!(readoutMagnitude > 0) || !(referenceMagnitude > 0)) {
    return {
      referenceVector,
      readoutVector: readout.w1,
      cosineAlignment: null,
      bestScalarCoefficient: null,
      bestScaledRelativeResidual: null,
    };
  }
  const denominator = vectorDot(readout.w1, readout.w1);
  const bestScalarCoefficient = vectorDot(referenceVector, readout.w1) / denominator;
  const residual = vectorSubtract(referenceVector, vectorScale(readout.w1, bestScalarCoefficient));
  return {
    referenceVector,
    readoutVector: readout.w1,
    cosineAlignment: vectorDot(referenceVector, readout.w1)
      / (referenceMagnitude * readoutMagnitude),
    bestScalarCoefficient,
    bestScaledRelativeResidual: vectorNorm(residual) / referenceMagnitude,
  };
}

function requireOddResolution(resolution: number): void {
  if (!Number.isInteger(resolution) || resolution < 17 || resolution % 2 === 0) {
    throw new Error("A4 synthetic resolution must be an odd integer >= 17");
  }
}

function buildGrid(
  resolution: number,
  minimum: Vec3,
  maximum: Vec3,
  sampler: (point: Vec3, spacing: Vec3) => readonly [number, number],
  id: string,
): ContinuousFieldSnapshotV1 {
  requireOddResolution(resolution);
  const spacing: Vec3 = [
    (maximum[0] - minimum[0]) / (resolution - 1),
    (maximum[1] - minimum[1]) / (resolution - 1),
    (maximum[2] - minimum[2]) / (resolution - 1),
  ];
  const rho: number[] = [];
  const ownerIds: number[] = [];
  for (let iz = 0; iz < resolution; iz += 1) {
    for (let iy = 0; iy < resolution; iy += 1) {
      for (let ix = 0; ix < resolution; ix += 1) {
        const point: Vec3 = [
          minimum[0] + spacing[0] * ix,
          minimum[1] + spacing[1] * iy,
          minimum[2] + spacing[2] * iz,
        ];
        const [density, ownerId] = sampler(point, spacing);
        rho.push(density);
        ownerIds.push(ownerId);
      }
    }
  }
  return {
    schema: "VOXELLAB_CONTINUOUS_FIELD_SNAPSHOT_V1",
    snapshotId: id,
    sourceClass: "SYNTHETIC_ORACLE",
    origin: minimum,
    spacing,
    dimensions: [resolution, resolution, resolution],
    rho,
    ownerIds,
    provenance: {
      sourceCommit: "A4_SYNTHETIC_METHOD_ORACLE",
      sourcePacketSha256: null,
      claimCeiling: "SYNTHETIC_REPRESENTATION_AND_INTEGRATION_METHOD_CONTROL_ONLY",
    },
  };
}

function fractionalSphereDensity(
  point: Vec3,
  spacing: Vec3,
  centre: Vec3,
  radius: number,
  density: number,
): number {
  let inside = 0;
  const offsets = [-0.25, 0.25] as const;
  for (const ox of offsets) for (const oy of offsets) for (const oz of offsets) {
    const dx = point[0] + ox * spacing[0] - centre[0];
    const dy = point[1] + oy * spacing[1] - centre[1];
    const dz = point[2] + oz * spacing[2] - centre[2];
    if (dx * dx + dy * dy + dz * dz <= radius ** 2) inside += 1;
  }
  return density * inside / 8;
}

export function createSyntheticUniformSphereFixture(resolution = 41): SyntheticBridgeFixture {
  const radius = 1;
  const density = 1;
  const extent = 1.25;
  const centre: Vec3 = [0, 0, 0];
  const snapshot = buildGrid(
    resolution,
    [-extent, -extent, -extent],
    [extent, extent, extent],
    (point, spacing) => {
      const sampled = fractionalSphereDensity(point, spacing, centre, radius, density);
      return [sampled, sampled > 0 ? 1 : 0];
    },
    `A4_SYNTHETIC_UNIFORM_SPHERE_N${resolution}`,
  );
  return {
    id: "UNIFORM_SPHERE",
    snapshot,
    receiver: [0, 0, -3],
    analyticSphere: { radius, density },
    note: "Synthetic uniform sphere used only for K2 integration parity; it is not a V5/V6/V14 snapshot.",
  };
}

export function createSyntheticTwoOwnerFixture(resolution = 41): SyntheticBridgeFixture {
  const nearCentre: Vec3 = [-0.16, 0, 0.25];
  const farCentre: Vec3 = [0.28, 0.04, 1.9];
  const nearRadius = 0.72;
  const farRadius = 0.92;
  const snapshot = buildGrid(
    resolution,
    [-1.45, -1.45, -1.1],
    [1.45, 1.45, 3.1],
    (point, spacing) => {
      const near = fractionalSphereDensity(point, spacing, nearCentre, nearRadius, 1);
      if (near > 0) return [near, 1];
      const far = fractionalSphereDensity(point, spacing, farCentre, farRadius, 1.25);
      return [far, far > 0 ? 2 : 0];
    },
    `A4_SYNTHETIC_TWO_OWNER_N${resolution}`,
  );
  return {
    id: "TWO_OWNER_COLUMN",
    snapshot,
    receiver: [0, 0, -3.4],
    analyticSphere: null,
    note: "Synthetic disjoint two-owner control. It tests transparent versus first-owner projection without asserting an opacity law.",
  };
}

export function runA4MethodGate(): A4MethodGateReceipt {
  const resolution = 41;
  const directionCount = 32768;
  const fixture = createSyntheticUniformSphereFixture(resolution);
  const options: ProjectionOptions = {
    directionCount,
    stepLength: Math.min(...fixture.snapshot.spacing) * 0.45,
  };
  const transparent = integrateContinuousFieldColumns(
    fixture.snapshot,
    fixture.receiver,
    "TRANSPARENT_FULL_COLUMN",
    options,
  );
  const firstOwner = integrateContinuousFieldColumns(
    fixture.snapshot,
    fixture.receiver,
    "FIRST_REGISTERED_OWNER_COLUMN",
    options,
  );
  const analytic = analyticSphereOutside(fixture.receiver, fixture.analyticSphere!);
  const rotatedReceiver: Vec3 = [-3, 0, 0];
  const rotated = integrateContinuousFieldColumns(
    fixture.snapshot,
    rotatedReceiver,
    "TRANSPARENT_FULL_COLUMN",
    options,
  );
  const curl = estimateActionCurl(
    fixture.snapshot,
    fixture.receiver,
    2 * Math.min(...fixture.snapshot.spacing),
    "TRANSPARENT_FULL_COLUMN",
    { ...options, directionCount: 8192 },
  );

  const oracle = {
    directionCount,
    resolution,
    transparentW0RelativeError: relativeError(transparent.w0, analytic.w0),
    transparentW1RelativeError: relativeError(transparent.w1Magnitude, analytic.w1Magnitude),
    firstOwnerW0RelativeDelta: relativeError(firstOwner.w0, transparent.w0),
    firstOwnerW1RelativeDelta: relativeError(firstOwner.w1Magnitude, transparent.w1Magnitude),
    rotationW0RelativeDelta: relativeError(rotated.w0, transparent.w0),
    rotationW1RelativeDelta: relativeError(rotated.w1Magnitude, transparent.w1Magnitude),
    traceClosureRelative: transparent.traceClosureRelative,
    normalizedCurl: curl.normalizedCurl,
  };
  const gates: A4MethodGate[] = [
    { id: "G01", label: "transparent W0 analytic parity", value: oracle.transparentW0RelativeError, threshold: 0.06, comparison: "MAX", pass: oracle.transparentW0RelativeError <= 0.06 },
    { id: "G02", label: "transparent W1 analytic parity", value: oracle.transparentW1RelativeError, threshold: 0.06, comparison: "MAX", pass: oracle.transparentW1RelativeError <= 0.06 },
    { id: "G03", label: "single-owner W0 projection identity", value: oracle.firstOwnerW0RelativeDelta, threshold: 1e-12, comparison: "MAX", pass: oracle.firstOwnerW0RelativeDelta <= 1e-12 },
    { id: "G04", label: "single-owner W1 projection identity", value: oracle.firstOwnerW1RelativeDelta, threshold: 1e-12, comparison: "MAX", pass: oracle.firstOwnerW1RelativeDelta <= 1e-12 },
    { id: "G05", label: "rotation W0 covariance", value: oracle.rotationW0RelativeDelta, threshold: 0.06, comparison: "MAX", pass: oracle.rotationW0RelativeDelta <= 0.06 },
    { id: "G06", label: "rotation W1 covariance", value: oracle.rotationW1RelativeDelta, threshold: 0.06, comparison: "MAX", pass: oracle.rotationW1RelativeDelta <= 0.06 },
    { id: "G07", label: "trace W2 equals W0", value: oracle.traceClosureRelative, threshold: 1e-12, comparison: "MAX", pass: oracle.traceClosureRelative <= 1e-12 },
    { id: "G08", label: "synthetic radial-field curl sanity", value: oracle.normalizedCurl, threshold: 0.35, comparison: "MAX", pass: oracle.normalizedCurl <= 0.35 },
  ];
  const methodPass = gates.every((gate) => gate.pass);
  return {
    schema: "VOXELLAB_A4_V14_CONTINUOUS_FIELD_ACTION_BRIDGE_GATE_V1",
    methodVerdict: methodPass
      ? "A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_PASS"
      : "A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_BLOCKER",
    overallVerdict: methodPass
      ? "A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER"
      : "A4_METHOD_BRIDGE_NUMERICAL_BLOCKER",
    snapshotExportStatus: "NO_FROZEN_V5_V6_V14_RHO_SNAPSHOT_ATTACHED",
    gates,
    oracle,
    claimCeiling: "CONTINUOUS_FIELD_ACTION_READOUT_METHOD_ONLY_NOT_PHYSICAL_FORCE",
    firewalls: [
      "READ_ONLY_NO_FEEDBACK_INTO_DYNAMICS",
      "NO_SYNTHETIC_FIXTURE_AS_V14_EVIDENCE",
      "NO_FIRST_OWNER_AS_FINAL_OPACITY_LAW",
      "NO_TRANSPARENCY_FIT_TO_TARGET_ROOT",
      "NO_PRESCRIBED_CAVITY_RADIUS",
      "NO_W1_AS_PHYSICAL_FORCE_BEFORE_DYNAMIC_PARITY",
      "NO_PHYSICAL_CADENCE",
      "NO_UPOR_CLAIM",
      "NO_SCALE_BINDING",
      "NO_VALIDATION",
      "NO_CANON_PROMOTION",
      "NO_MERGE",
    ],
  };
}
