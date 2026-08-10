import {
  DEFAULT_THRESHOLDS,
  REGIME_IDS,
  type Mat3,
  type PlaneDefinition,
  type PlaneResult,
  type QualifiedRoot,
  type RegimeClass,
  type RegimeSample,
  type RegimeThresholds,
  type Vec3,
  type VolumeFrame,
} from "./types";

const norm = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function wrap(value: number, n: number) {
  return ((value % n) + n) % n;
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function index(frame: VolumeFrame, x: number, y: number, z: number) {
  const [nx, ny, nz] = frame.dimensions;
  const ix = frame.periodic ? wrap(x, nx) : clamp(x, 0, nx - 1);
  const iy = frame.periodic ? wrap(y, ny) : clamp(y, 0, ny - 1);
  const iz = frame.periodic ? wrap(z, nz) : clamp(z, 0, nz - 1);
  return ((iz * ny + iy) * nx + ix) * 3;
}

export function sampleResponse(frame: VolumeFrame, point: Vec3): Vec3 {
  const g: Vec3 = [
    (point[0] - frame.origin[0]) / frame.spacing[0],
    (point[1] - frame.origin[1]) / frame.spacing[1],
    (point[2] - frame.origin[2]) / frame.spacing[2],
  ];
  const base: [number, number, number] = [Math.floor(g[0]), Math.floor(g[1]), Math.floor(g[2])];
  const f: Vec3 = [g[0] - base[0], g[1] - base[1], g[2] - base[2]];
  const result = [0, 0, 0];
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const weight = (dx ? f[0] : 1 - f[0]) * (dy ? f[1] : 1 - f[1]) * (dz ? f[2] : 1 - f[2]);
    const k = index(frame, base[0] + dx, base[1] + dy, base[2] + dz);
    result[0] = result[0]! + weight * frame.response[k]!;
    result[1] = result[1]! + weight * frame.response[k + 1]!;
    result[2] = result[2]! + weight * frame.response[k + 2]!;
  }
  return result as [number, number, number];
}

export function sampleDensity(frame: VolumeFrame, point: Vec3): number {
  if (!frame.rho) return 0;
  const [nx, ny, nz] = frame.dimensions;
  const g = point.map((value, axis) => (value - frame.origin[axis]!) / frame.spacing[axis]!) as number[];
  const b = g.map(Math.floor);
  let result = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const w = (dx ? g[0]! - b[0]! : 1 - g[0]! + b[0]!) * (dy ? g[1]! - b[1]! : 1 - g[1]! + b[1]!) * (dz ? g[2]! - b[2]! : 1 - g[2]! + b[2]!);
    const x = frame.periodic ? wrap(b[0]! + dx, nx) : clamp(b[0]! + dx, 0, nx - 1);
    const y = frame.periodic ? wrap(b[1]! + dy, ny) : clamp(b[1]! + dy, 0, ny - 1);
    const z = frame.periodic ? wrap(b[2]! + dz, nz) : clamp(b[2]! + dz, 0, nz - 1);
    result += w * frame.rho[(z * ny + y) * nx + x]!;
  }
  return result;
}

export function responseJacobian(frame: VolumeFrame, point: Vec3): Mat3 {
  const columns: Vec3[] = [];
  for (let axis = 0; axis < 3; axis++) {
    const d = [0, 0, 0] as [number, number, number];
    d[axis] = frame.spacing[axis]!;
    const plus = sampleResponse(frame, add(point, d));
    const minus = sampleResponse(frame, sub(point, d));
    columns.push(scale(sub(plus, minus), 1 / (2 * frame.spacing[axis]!)));
  }
  return [
    [columns[0]![0], columns[1]![0], columns[2]![0]],
    [columns[0]![1], columns[1]![1], columns[2]![1]],
    [columns[0]![2], columns[1]![2], columns[2]![2]],
  ];
}

function det3(m: Mat3) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

export function symmetricEigenvalues(matrix: Mat3): Vec3 {
  const a00 = matrix[0][0], a11 = matrix[1][1], a22 = matrix[2][2];
  const a01 = matrix[0][1], a02 = matrix[0][2], a12 = matrix[1][2];
  const p1 = a01 * a01 + a02 * a02 + a12 * a12;
  if (p1 === 0) return [a00, a11, a22].sort((a, b) => a - b) as [number, number, number];
  const q = (a00 + a11 + a22) / 3;
  const p2 = (a00 - q) ** 2 + (a11 - q) ** 2 + (a22 - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  if (p === 0) return [q, q, q];
  const b: Mat3 = [
    [(a00 - q) / p, a01 / p, a02 / p],
    [a01 / p, (a11 - q) / p, a12 / p],
    [a02 / p, a12 / p, (a22 - q) / p],
  ];
  const r = clamp(det3(b) / 2, -1, 1);
  const phi = Math.acos(r) / 3;
  const eMax = q + 2 * p * Math.cos(phi);
  const eMin = q + 2 * p * Math.cos(phi + 2 * Math.PI / 3);
  const eMid = 3 * q - eMax - eMin;
  return [eMin, eMid, eMax].sort((a, b2) => a - b2) as [number, number, number];
}

export function stiffnessFromJacobian(j: Mat3): { stiffness: Mat3; antisymmetryRatio: number } {
  const k = [
    [-j[0][0], -0.5 * (j[0][1] + j[1][0]), -0.5 * (j[0][2] + j[2][0])],
    [-0.5 * (j[1][0] + j[0][1]), -j[1][1], -0.5 * (j[1][2] + j[2][1])],
    [-0.5 * (j[2][0] + j[0][2]), -0.5 * (j[2][1] + j[1][2]), -j[2][2]],
  ] as Mat3;
  let symmetric2 = 0, anti2 = 0;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const s = 0.5 * (j[row]![col]! + j[col]![row]!);
    const a = 0.5 * (j[row]![col]! - j[col]![row]!);
    symmetric2 += s * s;
    anti2 += a * a;
  }
  return { stiffness: k, antisymmetryRatio: Math.sqrt(anti2) / Math.max(Math.sqrt(symmetric2), 1e-30) };
}

export function classifyEigenvalues(eigen: Vec3, anti: number, thresholds = DEFAULT_THRESHOLDS): RegimeClass {
  if (!eigen.every(Number.isFinite) || !Number.isFinite(anti) || anti > thresholds.antisymmetryTolerance) {
    return "NONCONSERVATIVE_OR_NUMERICALLY_UNRESOLVED";
  }
  if (eigen.some((value) => Math.abs(value) <= thresholds.neutralTolerance)) return "NEUTRAL_DEGENERATE_ROOT";
  const positives = eigen.filter((value) => value > thresholds.stiffnessTolerance).length;
  const negatives = eigen.filter((value) => value < -thresholds.stiffnessTolerance).length;
  if (positives === 3) return "RESTORING_ROOT";
  if (negatives === 3) return "REPELLING_ROOT";
  if (positives === 2 && negatives === 1) return "SADDLE_INDEX_1";
  if (positives === 1 && negatives === 2) return "SADDLE_INDEX_2";
  return "NEUTRAL_DEGENERATE_ROOT";
}

export function classifyAt(frame: VolumeFrame, point: Vec3, thresholds = DEFAULT_THRESHOLDS): RegimeSample {
  const response = sampleResponse(frame, point);
  const jacobian = responseJacobian(frame, point);
  const { stiffness, antisymmetryRatio } = stiffnessFromJacobian(jacobian);
  const stiffnessEigenvalues = symmetricEigenvalues(stiffness);
  const responseNorm = norm(response);
  return {
    response,
    responseNorm,
    jacobian,
    stiffnessEigenvalues,
    antisymmetryRatio,
    regime: classifyEigenvalues(stiffnessEigenvalues, antisymmetryRatio, thresholds),
    isRoot: responseNorm <= thresholds.rootTolerance,
  };
}

export function deriveFrameNeutralTolerance(frame: VolumeFrame): number {
  const [nx, ny, nz] = frame.dimensions;
  const magnitudes: number[] = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const point: Vec3 = [frame.origin[0] + x * frame.spacing[0], frame.origin[1] + y * frame.spacing[1], frame.origin[2] + z * frame.spacing[2]];
    const { stiffness } = stiffnessFromJacobian(responseJacobian(frame, point));
    magnitudes.push(...symmetricEigenvalues(stiffness).map(Math.abs));
  }
  magnitudes.sort((a, b) => a - b);
  const p95 = magnitudes[Math.floor(0.95 * (magnitudes.length - 1))] ?? 0;
  return Math.max(1e-6, 1e-3 * p95);
}

function solve3(a: Mat3, b: Vec3): Vec3 | null {
  const d = det3(a);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-14) return null;
  const replace = (column: number): Mat3 => a.map((row, r) => row.map((value, c) => c === column ? b[r]! : value) as unknown as Vec3) as unknown as Mat3;
  return [det3(replace(0)) / d, det3(replace(1)) / d, det3(replace(2)) / d];
}

function cellMayContainRoot(frame: VolumeFrame, x: number, y: number, z: number) {
  const [nx, ny] = frame.dimensions;
  for (let component = 0; component < 3; component++) {
    let lo = Infinity, hi = -Infinity;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const value = frame.response[(((z + dz) * ny + y + dy) * nx + x + dx) * 3 + component]!;
      lo = Math.min(lo, value); hi = Math.max(hi, value);
    }
    if (lo > 0 || hi < 0) return false;
  }
  return true;
}

function sampleCellWithJacobian(frame: VolumeFrame, x: number, y: number, z: number, point: Vec3): { response: Vec3; jacobian: Mat3 } {
  const [nx, ny] = frame.dimensions;
  const low: Vec3 = [frame.origin[0] + x * frame.spacing[0], frame.origin[1] + y * frame.spacing[1], frame.origin[2] + z * frame.spacing[2]];
  const q: Vec3 = [
    clamp((point[0] - low[0]) / frame.spacing[0], 0, 1),
    clamp((point[1] - low[1]) / frame.spacing[1], 0, 1),
    clamp((point[2] - low[2]) / frame.spacing[2], 0, 1),
  ];
  const response = [0, 0, 0];
  const columns = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const wx = dx ? q[0] : 1 - q[0], wy = dy ? q[1] : 1 - q[1], wz = dz ? q[2] : 1 - q[2];
    const weights = [wx * wy * wz, (dx ? 1 : -1) * wy * wz / frame.spacing[0], wx * (dy ? 1 : -1) * wz / frame.spacing[1], wx * wy * (dz ? 1 : -1) / frame.spacing[2]];
    const base = (((z + dz) * ny + y + dy) * nx + x + dx) * 3;
    for (let component = 0; component < 3; component++) {
      const value = frame.response[base + component]!;
      response[component] = response[component]! + weights[0]! * value;
      for (let axis = 0; axis < 3; axis++) columns[axis]![component] = columns[axis]![component]! + weights[axis + 1]! * value;
    }
  }
  return {
    response: response as [number, number, number],
    jacobian: [
      [columns[0]![0]!, columns[1]![0]!, columns[2]![0]!],
      [columns[0]![1]!, columns[1]![1]!, columns[2]![1]!],
      [columns[0]![2]!, columns[1]![2]!, columns[2]![2]!],
    ],
  };
}

export function findQualifiedRoots(
  frame: VolumeFrame,
  frameIndex: number,
  relativeRootTolerance = 2e-4,
  thresholds: RegimeThresholds = DEFAULT_THRESHOLDS,
): QualifiedRoot[] {
  const [nx, ny, nz] = frame.dimensions;
  let responseScale = 0;
  for (let i = 0; i < frame.response.length; i += 3) responseScale = Math.max(responseScale, Math.hypot(frame.response[i]!, frame.response[i + 1]!, frame.response[i + 2]!));
  // A globally zero response is a degenerate continuum, not thousands of
  // isolated equilibrium roots. Root branch identity is undefined there.
  if (responseScale <= 1e-12) return [];
  const rootTolerance = Math.max(responseScale * relativeRootTolerance, 1e-10);
  const roots: QualifiedRoot[] = [];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    if (!cellMayContainRoot(frame, x, y, z)) continue;
    const low: Vec3 = [frame.origin[0] + x * frame.spacing[0], frame.origin[1] + y * frame.spacing[1], frame.origin[2] + z * frame.spacing[2]];
    const high = add(low, frame.spacing);
    let p = scale(add(low, high), 0.5);
    for (let iteration = 0; iteration < 12; iteration++) {
      const local = sampleCellWithJacobian(frame, x, y, z, p);
      const r = local.response;
      if (norm(r) <= rootTolerance * 0.1) break;
      const delta = solve3(local.jacobian, scale(r, -1));
      if (!delta) break;
      const candidate = add(p, delta);
      p = [clamp(candidate[0], low[0], high[0]), clamp(candidate[1], low[1], high[1]), clamp(candidate[2], low[2], high[2])];
    }
    const sample = classifyAt(frame, p, { ...thresholds, rootTolerance });
    if (!sample.isRoot) continue;
    const duplicate = roots.some((root) => norm(sub(root.position, p)) < Math.min(...frame.spacing) * 0.25);
    if (!duplicate) roots.push({
      ...sample,
      id: `f${frameIndex}-r${roots.length}`,
      frameIndex,
      position: p,
      residualRelative: sample.responseNorm / Math.max(responseScale, 1e-30),
    });
  }
  return roots;
}

export function samplePlaneCpu(
  frame: VolumeFrame,
  plane: PlaneDefinition,
  width: number,
  height: number,
  thresholds = DEFAULT_THRESHOLDS,
): PlaneResult {
  const started = performance.now();
  const response = new Float32Array(width * height * 4);
  const eigenvalues = new Float32Array(width * height * 3);
  const antisymmetry = new Float32Array(width * height);
  const classes = new Uint32Array(width * height);
  for (let iy = 0; iy < height; iy++) for (let ix = 0; ix < width; ix++) {
    const u = width === 1 ? 0 : (2 * ix / (width - 1) - 1) * plane.extentU;
    const v = height === 1 ? 0 : (2 * iy / (height - 1) - 1) * plane.extentV;
    const point = add(plane.origin, add(scale(plane.axisU, u), scale(plane.axisV, v)));
    const sample = classifyAt(frame, point, thresholds);
    const i = iy * width + ix;
    response.set([...sample.response, sample.responseNorm], i * 4);
    eigenvalues.set(sample.stiffnessEigenvalues, i * 3);
    antisymmetry[i] = sample.antisymmetryRatio;
    classes[i] = REGIME_IDS[sample.regime];
  }
  return { width, height, response, eigenvalues, antisymmetry, classes, backend: "CPU_REFERENCE", elapsedMs: performance.now() - started };
}
