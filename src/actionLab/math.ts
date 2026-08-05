export type Vec3 = readonly [number, number, number];

export interface SphereModel {
  radius: number;
  density: number;
}

export interface FieldSample {
  w0: number;
  w1: Vec3;
  w1Magnitude: number;
}

export interface RendererSample extends FieldSample {
  sampleCount: number;
  hitCount: number;
  capSolidAngle: number;
}

export interface VolumeCubature {
  points: Vec3[];
  sampleVolume: number;
}

const TAU = 2 * Math.PI;

export function vectorNorm(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function scale(value: Vec3, factor: number): Vec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
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
  if (!(magnitude > 0)) throw new Error("Cannot normalize a zero vector");
  return scale(value, 1 / magnitude);
}

function requireOutsideSphere(probe: Vec3, model: SphereModel): number {
  if (!(model.radius > 0) || !(model.density > 0)) throw new Error("Sphere radius and density must be positive");
  const distance = vectorNorm(probe);
  if (!(distance > model.radius)) throw new Error("A0 fixture samples only probes outside the formed body");
  return distance;
}

export function sphereVolume(model: SphereModel): number {
  return (4 / 3) * Math.PI * model.radius ** 3;
}

export function analyticSphereOutside(probe: Vec3, model: SphereModel): FieldSample {
  const distance = requireOutsideSphere(probe, model);
  const radiusRatio = model.radius / distance;
  const aSquared = Math.max(0, 1 - radiusRatio ** 2);
  const logarithmicTerm = aSquared < 1e-15
    ? 0
    : aSquared * Math.log((1 + radiusRatio) / Math.sqrt(aSquared));
  const w0 = TAU * model.density * distance * (radiusRatio - logarithmicTerm);
  const w1Magnitude = model.density * sphereVolume(model) / distance ** 2;
  const centreDirection = scale(probe, -1 / distance);
  return { w0, w1: scale(centreDirection, w1Magnitude), w1Magnitude };
}

function legendreWithDerivative(order: number, x: number): readonly [number, number] {
  let p0 = 1;
  let p1 = x;
  if (order === 0) return [p0, 0];
  if (order === 1) return [p1, 1];
  for (let n = 2; n <= order; n += 1) {
    const pn = ((2 * n - 1) * x * p1 - (n - 1) * p0) / n;
    p0 = p1;
    p1 = pn;
  }
  const derivative = order * (x * p1 - p0) / (x ** 2 - 1);
  return [p1, derivative];
}

export function gaussLegendre(order: number): { nodes: number[]; weights: number[] } {
  if (!Number.isInteger(order) || order < 2) throw new Error("Gauss-Legendre order must be an integer >= 2");
  const nodes = Array<number>(order).fill(0);
  const weights = Array<number>(order).fill(0);
  const half = Math.ceil(order / 2);
  for (let i = 0; i < half; i += 1) {
    let x = Math.cos(Math.PI * (i + 0.75) / (order + 0.5));
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const [value, derivative] = legendreWithDerivative(order, x);
      const next = x - value / derivative;
      if (Math.abs(next - x) < 1e-15) {
        x = next;
        break;
      }
      x = next;
    }
    const [, derivative] = legendreWithDerivative(order, x);
    const weight = 2 / ((1 - x ** 2) * derivative ** 2);
    const mirror = order - 1 - i;
    nodes[i] = -x;
    nodes[mirror] = x;
    weights[i] = weight;
    weights[mirror] = weight;
  }
  return { nodes, weights };
}

export function curvedSolidAngleSphere(probe: Vec3, model: SphereModel, order = 96): FieldSample {
  const distance = requireOutsideSphere(probe, model);
  const centreDirection = scale(probe, -1 / distance);
  const alpha = Math.asin(model.radius / distance);
  const { nodes, weights } = gaussLegendre(order);
  let scalarIntegral = 0;
  let axialIntegral = 0;
  for (let i = 0; i < order; i += 1) {
    const node = nodes[i];
    const weight = weights[i];
    if (node === undefined || weight === undefined) throw new Error("Incomplete Gauss-Legendre rule");
    const theta = 0.5 * alpha * (node + 1);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const chord = 2 * Math.sqrt(Math.max(0, model.radius ** 2 - distance ** 2 * sinTheta ** 2));
    scalarIntegral += weight * chord * sinTheta;
    axialIntegral += weight * chord * cosTheta * sinTheta;
  }
  const scaleFactor = Math.PI * alpha * model.density;
  const w0 = scaleFactor * scalarIntegral;
  const w1Magnitude = scaleFactor * axialIntegral;
  return { w0, w1: scale(centreDirection, w1Magnitude), w1Magnitude };
}

export function raySphereInterval(origin: Vec3, direction: Vec3, radius: number): readonly [number, number] | null {
  const unitDirection = normalize(direction);
  const b = dot(origin, unitDirection);
  const c = dot(origin, origin) - radius ** 2;
  const discriminant = b ** 2 - c;
  if (discriminant <= 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root;
  const far = -b + root;
  if (far <= 0) return null;
  return [Math.max(0, near), far];
}

function radicalInverseVanDerCorput(index: number): number {
  let bits = index >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10;
}

function orthonormalBasis(axis: Vec3): readonly [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const tangent = normalize(cross(helper, axis));
  return [tangent, cross(axis, tangent)];
}

export function rendererCapImportanceSphere(probe: Vec3, model: SphereModel, sampleCount = 4096): RendererSample {
  const distance = requireOutsideSphere(probe, model);
  if (!Number.isInteger(sampleCount) || sampleCount < 32) throw new Error("Renderer sample count must be an integer >= 32");
  const axis = scale(probe, -1 / distance);
  const [tangent, bitangent] = orthonormalBasis(axis);
  const capCosine = Math.sqrt(Math.max(0, 1 - (model.radius / distance) ** 2));
  const capSolidAngle = TAU * (1 - capCosine);
  const sampleWeight = capSolidAngle / sampleCount;
  let w0 = 0;
  let w1: Vec3 = [0, 0, 0];
  let hitCount = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const u = (i + 0.5) / sampleCount;
    const v = radicalInverseVanDerCorput(i);
    const cosTheta = 1 - u * (1 - capCosine);
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta ** 2));
    const phi = TAU * v;
    const direction = add(
      scale(axis, cosTheta),
      add(scale(tangent, sinTheta * Math.cos(phi)), scale(bitangent, sinTheta * Math.sin(phi))),
    );
    const interval = raySphereInterval(probe, direction, model.radius);
    if (!interval) continue;
    const chord = interval[1] - interval[0];
    const action = model.density * chord * sampleWeight;
    w0 += action;
    w1 = add(w1, scale(direction, action));
    hitCount += 1;
  }
  return { w0, w1, w1Magnitude: vectorNorm(w1), sampleCount, hitCount, capSolidAngle };
}

function fibonacciDirections(count: number): Vec3[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const result: Vec3[] = [];
  for (let i = 0; i < count; i += 1) {
    const z = 1 - 2 * (i + 0.5) / count;
    const radial = Math.sqrt(Math.max(0, 1 - z ** 2));
    const phi = goldenAngle * i;
    result.push([radial * Math.cos(phi), radial * Math.sin(phi), z]);
  }
  return result;
}

export function createVolumeCubature(model: SphereModel, radialShells = 16, angularSamples = 1024): VolumeCubature {
  if (!Number.isInteger(radialShells) || radialShells < 2) throw new Error("radialShells must be an integer >= 2");
  if (!Number.isInteger(angularSamples) || angularSamples < 32) throw new Error("angularSamples must be an integer >= 32");
  const directions = fibonacciDirections(angularSamples);
  const points: Vec3[] = [];
  for (let shell = 0; shell < radialShells; shell += 1) {
    const radius = model.radius * Math.cbrt((shell + 0.5) / radialShells);
    for (const direction of directions) points.push(scale(direction, radius));
  }
  return { points, sampleVolume: sphereVolume(model) / points.length };
}

export function distributedVolumeSphere(probe: Vec3, model: SphereModel, cubature: VolumeCubature): FieldSample {
  requireOutsideSphere(probe, model);
  let w0 = 0;
  let w1: Vec3 = [0, 0, 0];
  const weightedVolume = model.density * cubature.sampleVolume;
  for (const point of cubature.points) {
    const displacement: Vec3 = [point[0] - probe[0], point[1] - probe[1], point[2] - probe[2]];
    const distance = vectorNorm(displacement);
    const scalarAction = weightedVolume / distance ** 2;
    w0 += scalarAction;
    w1 = add(w1, scale(displacement, weightedVolume / distance ** 3));
  }
  return { w0, w1, w1Magnitude: vectorNorm(w1) };
}

export function relativeError(value: number, reference: number): number {
  if (reference === 0) return value === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(value - reference) / Math.abs(reference);
}

export function normalizedDisplayValue(sample: FieldSample, model: SphereModel, channel: "W0" | "W1"): number {
  if (channel === "W0") return sample.w0 / (TAU * model.density * model.radius);
  return sample.w1Magnitude / ((4 / 3) * Math.PI * model.density * model.radius);
}

export function chordProfile(distance: number, model: SphereModel, samples = 96): Array<{ radialFraction: number; chord: number }> {
  if (!(distance > model.radius)) throw new Error("Chord profile requires an exterior probe");
  const result: Array<{ radialFraction: number; chord: number }> = [];
  for (let i = 0; i <= samples; i += 1) {
    const radialFraction = i / samples;
    const impact = model.radius * radialFraction;
    result.push({ radialFraction, chord: 2 * Math.sqrt(Math.max(0, model.radius ** 2 - impact ** 2)) });
  }
  return result;
}
