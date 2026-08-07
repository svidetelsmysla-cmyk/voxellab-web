import { analyticSphereOutside, curvedSolidAngleSphere, type Vec3 } from "./math";

export interface FormedClumpSphere {
  id: string;
  centre: Vec3;
  radius: number;
  density: number;
}

export interface ColumnCell {
  index: number;
  direction: Vec3;
  solidAngle: number;
  ownerId: string | null;
  entry: number | null;
  exit: number | null;
  chord: number;
  density: number;
  columnAmount: number;
}

export interface FirstHitColumnResult {
  sampleCount: number;
  openSkyCount: number;
  ownerCounts: Record<string, number>;
  w0: number;
  w1: Vec3;
  w1Magnitude: number;
  w2: readonly [Vec3, Vec3, Vec3];
  cells: ColumnCell[];
}

export interface BinaryOwnershipResult {
  sampleCount: number;
  openSkyCount: number;
  ownerCounts: Record<string, number>;
  coverageSolidAngle: number;
  w1: Vec3;
  w1Magnitude: number;
}

export interface SingleSphereParity {
  analyticW0: number;
  analyticW1: number;
  curvedW0: number;
  curvedW1: number;
  columnW0: number;
  columnW1: number;
  relativeW0Error: number;
  relativeW1Error: number;
}

type MutableVec3 = [number, number, number];
type MutableMat3 = [MutableVec3, MutableVec3, MutableVec3];

const FOUR_PI = 4 * Math.PI;

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function relativeError(value: number, reference: number): number {
  if (reference === 0) return value === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(value - reference) / Math.abs(reference);
}

export function fibonacciDirections(count: number): Vec3[] {
  if (!Number.isInteger(count) || count < 32) throw new Error("direction count must be an integer >= 32");
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const result: Vec3[] = [];
  for (let i = 0; i < count; i += 1) {
    const z = 1 - 2 * (i + 0.5) / count;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = goldenAngle * i;
    result.push([radial * Math.cos(phi), radial * Math.sin(phi), z]);
  }
  return result;
}

export function raySphereIntervalAt(
  origin: Vec3,
  direction: Vec3,
  sphere: FormedClumpSphere,
): readonly [number, number] | null {
  if (!(sphere.radius > 0) || !(sphere.density > 0)) throw new Error("formed clump radius and density must be positive");
  const dNorm = norm(direction);
  if (!(dNorm > 0)) throw new Error("ray direction must be nonzero");
  const d = scale(direction, 1 / dNorm);
  const oc = subtract(origin, sphere.centre);
  const b = dot(oc, d);
  const c = dot(oc, oc) - sphere.radius ** 2;
  const discriminant = b * b - c;
  if (discriminant <= 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root;
  const far = -b + root;
  if (far <= 0) return null;
  return [Math.max(0, near), far];
}

function emptyW2(): MutableMat3 {
  return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
}

function addOuterProduct(target: MutableMat3, direction: Vec3, weight: number): void {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      target[row][col] += direction[row] * direction[col] * weight;
    }
  }
}

export function integrateFirstHitContinuousColumns(
  receiver: Vec3,
  clumps: readonly FormedClumpSphere[],
  sampleCount = 12288,
): FirstHitColumnResult {
  if (clumps.length === 0) throw new Error("at least one formed clump is required");
  const directions = fibonacciDirections(sampleCount);
  const solidAngle = FOUR_PI / sampleCount;
  const ownerCounts: Record<string, number> = {};
  const cells: ColumnCell[] = [];
  const w2Mutable = emptyW2();
  let w0 = 0;
  let w1: Vec3 = [0, 0, 0];
  let openSkyCount = 0;

  directions.forEach((direction, index) => {
    let owner: FormedClumpSphere | null = null;
    let ownerInterval: readonly [number, number] | null = null;
    let nearestEntry = Number.POSITIVE_INFINITY;

    for (const clump of clumps) {
      const interval = raySphereIntervalAt(receiver, direction, clump);
      if (!interval) continue;
      if (interval[0] < nearestEntry) {
        nearestEntry = interval[0];
        owner = clump;
        ownerInterval = interval;
      }
    }

    if (!owner || !ownerInterval) {
      openSkyCount += 1;
      cells.push({ index, direction, solidAngle, ownerId: null, entry: null, exit: null, chord: 0, density: 0, columnAmount: 0 });
      return;
    }

    const chord = ownerInterval[1] - ownerInterval[0];
    const columnAmount = owner.density * chord * solidAngle;
    ownerCounts[owner.id] = (ownerCounts[owner.id] ?? 0) + 1;
    w0 += columnAmount;
    w1 = add(w1, scale(direction, columnAmount));
    addOuterProduct(w2Mutable, direction, columnAmount);
    cells.push({
      index,
      direction,
      solidAngle,
      ownerId: owner.id,
      entry: ownerInterval[0],
      exit: ownerInterval[1],
      chord,
      density: owner.density,
      columnAmount,
    });
  });

  return {
    sampleCount,
    openSkyCount,
    ownerCounts,
    w0,
    w1,
    w1Magnitude: norm(w1),
    w2: [
      [w2Mutable[0][0], w2Mutable[0][1], w2Mutable[0][2]],
      [w2Mutable[1][0], w2Mutable[1][1], w2Mutable[1][2]],
      [w2Mutable[2][0], w2Mutable[2][1], w2Mutable[2][2]],
    ],
    cells,
  };
}

export function integrateBinaryFirstHitOwnership(
  receiver: Vec3,
  clumps: readonly FormedClumpSphere[],
  sampleCount = 12288,
): BinaryOwnershipResult {
  const directions = fibonacciDirections(sampleCount);
  const solidAngle = FOUR_PI / sampleCount;
  const ownerCounts: Record<string, number> = {};
  let openSkyCount = 0;
  let coverageSolidAngle = 0;
  let w1: Vec3 = [0, 0, 0];

  for (const direction of directions) {
    let owner: FormedClumpSphere | null = null;
    let nearestEntry = Number.POSITIVE_INFINITY;
    for (const clump of clumps) {
      const interval = raySphereIntervalAt(receiver, direction, clump);
      if (!interval) continue;
      if (interval[0] < nearestEntry) {
        nearestEntry = interval[0];
        owner = clump;
      }
    }
    if (!owner) {
      openSkyCount += 1;
      continue;
    }
    ownerCounts[owner.id] = (ownerCounts[owner.id] ?? 0) + 1;
    coverageSolidAngle += solidAngle;
    w1 = add(w1, scale(direction, solidAngle));
  }

  return { sampleCount, openSkyCount, ownerCounts, coverageSolidAngle, w1, w1Magnitude: norm(w1) };
}

export function singleSphereParity(
  receiver: Vec3,
  clump: FormedClumpSphere,
  sampleCount = 49152,
): SingleSphereParity {
  const relativeProbe = subtract(receiver, clump.centre);
  const model = { radius: clump.radius, density: clump.density };
  const analytic = analyticSphereOutside(relativeProbe, model);
  const curved = curvedSolidAngleSphere(relativeProbe, model, 96);
  const column = integrateFirstHitContinuousColumns(receiver, [clump], sampleCount);
  return {
    analyticW0: analytic.w0,
    analyticW1: analytic.w1Magnitude,
    curvedW0: curved.w0,
    curvedW1: curved.w1Magnitude,
    columnW0: column.w0,
    columnW1: column.w1Magnitude,
    relativeW0Error: relativeError(column.w0, analytic.w0),
    relativeW1Error: relativeError(column.w1Magnitude, analytic.w1Magnitude),
  };
}

export function selectedCell(result: FirstHitColumnResult, index: number): ColumnCell {
  const clamped = Math.max(0, Math.min(result.cells.length - 1, Math.floor(index)));
  const cell = result.cells[clamped];
  if (!cell) throw new Error("selected angular cell not found");
  return cell;
}
