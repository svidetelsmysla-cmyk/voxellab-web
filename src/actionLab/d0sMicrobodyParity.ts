import {
  analyticSphereOutside,
  relativeError,
  sphereVolume,
  vectorNorm,
  type FieldSample,
  type SphereModel,
  type Vec3,
} from "./math";

export type D0SLevelId = "N48" | "N192" | "N768" | "N3072";

export interface D0SLevelDefinition {
  id: D0SLevelId;
  count: number;
  shellCount: number;
}

export interface D0SMicrobody {
  position: Vec3;
  amount: number;
  shellIndex: number;
}

export interface D0SProbeRow {
  radiusRatio: number;
  directionId: string;
  analyticW0: number;
  discreteW0: number;
  analyticW1Magnitude: number;
  discreteW1Magnitude: number;
  w0RelativeError: number;
  w1MagnitudeRelativeError: number;
  w1VectorRelativeError: number;
}

export interface D0SMultipolePowers {
  l1: number;
  l2: number;
  l3: number;
  l4: number;
}

export interface D0SLevelMetrics {
  definition: D0SLevelDefinition;
  shellCounts: number[];
  amountClosureResidual: number;
  centreOfAmountResidualOverR: number;
  equalWeightSpreadOverMean: number;
  maximumW0RelativeError: number;
  maximumW1MagnitudeRelativeError: number;
  maximumW1VectorRelativeError: number;
  maximumW0OrientationSpread: number;
  maximumW1OrientationSpread: number;
  permutationW0Delta: number;
  permutationW1Delta: number;
  rotationW0Delta: number;
  rotationW1Delta: number;
  multipoles: D0SMultipolePowers;
  worstW0Probe: D0SProbeRow;
  worstW1Probe: D0SProbeRow;
  worstVectorProbe: D0SProbeRow;
  probeRows: D0SProbeRow[];
}

export interface D0SGateStatus {
  id: string;
  label: string;
  value: number;
  threshold: number;
  pass: boolean;
  comparison: "MAX" | "MIN_RATIO" | "DECREASE";
}

export interface D0SParityResult {
  schema: "VOXELLAB_D0S_STATIC_MICROBODY_PARITY_V1";
  model: SphereModel;
  levels: D0SLevelMetrics[];
  gates: D0SGateStatus[];
  verdict:
    | "D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS"
    | "D0S_PACKING_OR_REFINEMENT_BLOCKER"
    | "D0S_NUMERICAL_OR_PROVENANCE_BLOCKER";
  d0mStatus: "OPEN_AFTER_D0S_PASS" | "CLOSED_BY_D0S_BLOCKER";
  claimCeiling: string;
  firewalls: string[];
}

export const D0S_LEVELS: readonly D0SLevelDefinition[] = [
  { id: "N48", count: 48, shellCount: 3 },
  { id: "N192", count: 192, shellCount: 5 },
  { id: "N768", count: 768, shellCount: 8 },
  { id: "N3072", count: 3072, shellCount: 12 },
] as const;

export const D0S_RADIUS_RATIOS = [1.2, 1.5, 2, 3, 5, 8] as const;

const RAW_DIRECTIONS: readonly { id: string; value: Vec3 }[] = [
  { id: "+X", value: [1, 0, 0] },
  { id: "+Y", value: [0, 1, 0] },
  { id: "+Z", value: [0, 0, 1] },
  { id: "111", value: [1, 1, 1] },
  { id: "1-11", value: [1, -1, 1] },
  { id: "21-1", value: [2, 1, -1] },
  { id: "-121", value: [-1, 2, 1] },
] as const;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ROTATION_AXIS: Vec3 = normalize([1, 2, 3]);
const GLOBAL_ROTATION_ANGLE = 0.731;

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
  if (!(magnitude > 0)) throw new Error("D0S cannot normalize a zero vector");
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

function requireModel(model: SphereModel): void {
  if (!(model.radius > 0) || !(model.density > 0)) {
    throw new Error("D0S sphere radius and density must be positive");
  }
}

function allocateEvenShellCounts(total: number, shellCount: number): number[] {
  if (!Number.isInteger(total) || total < 2 || total % 2 !== 0) {
    throw new Error("D0S total microbody count must be a positive even integer");
  }
  if (!Number.isInteger(shellCount) || shellCount < 1 || total < 2 * shellCount) {
    throw new Error("D0S shell count must allow at least one antipodal pair per shell");
  }

  const counts = Array<number>(shellCount).fill(2);
  const remaining = total - 2 * shellCount;
  const weights = Array.from({ length: shellCount }, (_, index) => (index + 0.5) ** 2);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const raw = weights.map((weight) => remaining * weight / weightSum);
  const increments = raw.map((value) => 2 * Math.floor(value / 2));
  for (let index = 0; index < shellCount; index += 1) counts[index]! += increments[index]!;

  let leftover = total - counts.reduce((sum, value) => sum + value, 0);
  const order = Array.from({ length: shellCount }, (_, index) => index).sort((left, right) => {
    const leftRemainder = raw[left]! - increments[left]!;
    const rightRemainder = raw[right]! - increments[right]!;
    if (rightRemainder !== leftRemainder) return rightRemainder - leftRemainder;
    return weights[right]! - weights[left]!;
  });
  let cursor = 0;
  while (leftover > 0) {
    counts[order[cursor % order.length]!]! += 2;
    leftover -= 2;
    cursor += 1;
  }
  return counts;
}

function shellPairDirection(pairIndex: number, pairCount: number, shellIndex: number): Vec3 {
  const z = (pairIndex + 0.5) / pairCount;
  const radial = Math.sqrt(Math.max(0, 1 - z ** 2));
  const phi = GOLDEN_ANGLE * pairIndex + (shellIndex + 1) * 0.6180339887498948;
  const base: Vec3 = [radial * Math.cos(phi), radial * Math.sin(phi), z];
  return rotateAxisAngle(base, ROTATION_AXIS, (shellIndex + 1) * 0.347);
}

export function generateD0SMicrobodies(
  model: SphereModel,
  definition: D0SLevelDefinition,
): { bodies: D0SMicrobody[]; shellCounts: number[] } {
  requireModel(model);
  const shellCounts = allocateEvenShellCounts(definition.count, definition.shellCount);
  const equalAmount = model.density * sphereVolume(model) / definition.count;
  const rawBodies: D0SMicrobody[] = [];
  let cumulative = 0;

  for (let shellIndex = 0; shellIndex < shellCounts.length; shellIndex += 1) {
    const count = shellCounts[shellIndex]!;
    const lowerVolumeFraction = cumulative / definition.count;
    const upperVolumeFraction = (cumulative + count) / definition.count;
    const radius = model.radius * Math.cbrt((lowerVolumeFraction + upperVolumeFraction) / 2);
    const pairCount = count / 2;
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const direction = shellPairDirection(pairIndex, pairCount, shellIndex);
      const position = scale(direction, radius);
      rawBodies.push({ position, amount: equalAmount, shellIndex });
      rawBodies.push({ position: scale(position, -1), amount: equalAmount, shellIndex });
    }
    cumulative += count;
  }

  const totalAmount = rawBodies.reduce((sum, body) => sum + body.amount, 0);
  const centre = scale(
    rawBodies.reduce<Vec3>((sum, body) => add(sum, scale(body.position, body.amount)), [0, 0, 0]),
    1 / totalAmount,
  );
  const bodies = rawBodies.map((body) => ({ ...body, position: subtract(body.position, centre) }));
  return { bodies, shellCounts };
}

export function evaluateD0SMicrobodies(probe: Vec3, bodies: readonly D0SMicrobody[]): FieldSample {
  let w0 = 0;
  let w1: Vec3 = [0, 0, 0];
  for (const body of bodies) {
    const displacement = subtract(body.position, probe);
    const distance = vectorNorm(displacement);
    if (!(distance > 0)) throw new Error("D0S probe coincides with a microbody");
    w0 += body.amount / distance ** 2;
    w1 = add(w1, scale(displacement, body.amount / distance ** 3));
  }
  return { w0, w1, w1Magnitude: vectorNorm(w1) };
}

function vectorRelativeError(value: Vec3, reference: Vec3): number {
  const denominator = vectorNorm(reference);
  if (!(denominator > 0)) return vectorNorm(value);
  return vectorNorm(subtract(value, reference)) / denominator;
}

function deterministicPermutation<T>(values: readonly T[]): T[] {
  const result = [...values];
  let state = 0x9e3779b9;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    const temporary = result[index]!;
    result[index] = result[target]!;
    result[target] = temporary;
  }
  return result;
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

function realMultipolePower(bodies: readonly D0SMicrobody[], degree: number): number {
  const directions = bodies.map((body) => normalize(body.position));
  const coefficients: number[] = [];
  const zeroNorm = Math.sqrt((2 * degree + 1) / (4 * Math.PI));
  coefficients.push(directions.reduce(
    (sum, direction) => sum + zeroNorm * associatedLegendre(degree, 0, direction[2]),
    0,
  ) / directions.length);

  for (let order = 1; order <= degree; order += 1) {
    const normalization = Math.sqrt(2) * Math.sqrt(
      (2 * degree + 1) / (4 * Math.PI)
      * factorial(degree - order) / factorial(degree + order),
    );
    let cosineCoefficient = 0;
    let sineCoefficient = 0;
    for (const direction of directions) {
      const phi = Math.atan2(direction[1], direction[0]);
      const basis = normalization * associatedLegendre(degree, order, direction[2]);
      cosineCoefficient += basis * Math.cos(order * phi);
      sineCoefficient += basis * Math.sin(order * phi);
    }
    coefficients.push(cosineCoefficient / directions.length, sineCoefficient / directions.length);
  }

  return Math.sqrt(coefficients.reduce((sum, value) => sum + value ** 2, 0)) * Math.sqrt(4 * Math.PI);
}

export function d0sMultipolePowers(bodies: readonly D0SMicrobody[]): D0SMultipolePowers {
  return {
    l1: realMultipolePower(bodies, 1),
    l2: realMultipolePower(bodies, 2),
    l3: realMultipolePower(bodies, 3),
    l4: realMultipolePower(bodies, 4),
  };
}

function allProbeDefinitions(model: SphereModel): Array<{ radiusRatio: number; directionId: string; probe: Vec3 }> {
  return D0S_RADIUS_RATIOS.flatMap((radiusRatio) => RAW_DIRECTIONS.map((entry) => {
    const direction = normalize(entry.value);
    return { radiusRatio, directionId: entry.id, probe: scale(direction, radiusRatio * model.radius) };
  }));
}

function maximum(values: readonly number[]): number {
  return values.reduce((result, value) => Math.max(result, value), 0);
}

function worstRow(rows: readonly D0SProbeRow[], selector: (row: D0SProbeRow) => number): D0SProbeRow {
  const first = rows[0];
  if (!first) throw new Error("D0S produced no probe rows");
  return rows.reduce((worst, row) => selector(row) > selector(worst) ? row : worst, first);
}

export function runD0SLevel(model: SphereModel, definition: D0SLevelDefinition): D0SLevelMetrics {
  requireModel(model);
  const { bodies, shellCounts } = generateD0SMicrobodies(model, definition);
  const probes = allProbeDefinitions(model);
  const probeRows = probes.map<D0SProbeRow>(({ radiusRatio, directionId, probe }) => {
    const analytic = analyticSphereOutside(probe, model);
    const discrete = evaluateD0SMicrobodies(probe, bodies);
    return {
      radiusRatio,
      directionId,
      analyticW0: analytic.w0,
      discreteW0: discrete.w0,
      analyticW1Magnitude: analytic.w1Magnitude,
      discreteW1Magnitude: discrete.w1Magnitude,
      w0RelativeError: relativeError(discrete.w0, analytic.w0),
      w1MagnitudeRelativeError: relativeError(discrete.w1Magnitude, analytic.w1Magnitude),
      w1VectorRelativeError: vectorRelativeError(discrete.w1, analytic.w1),
    };
  });

  let maximumW0OrientationSpread = 0;
  let maximumW1OrientationSpread = 0;
  for (const radiusRatio of D0S_RADIUS_RATIOS) {
    const rows = probeRows.filter((row) => row.radiusRatio === radiusRatio);
    const analyticW0 = rows[0]!.analyticW0;
    const analyticW1 = rows[0]!.analyticW1Magnitude;
    const w0Values = rows.map((row) => row.discreteW0);
    const w1Values = rows.map((row) => row.discreteW1Magnitude);
    maximumW0OrientationSpread = Math.max(
      maximumW0OrientationSpread,
      (Math.max(...w0Values) - Math.min(...w0Values)) / analyticW0,
    );
    maximumW1OrientationSpread = Math.max(
      maximumW1OrientationSpread,
      (Math.max(...w1Values) - Math.min(...w1Values)) / analyticW1,
    );
  }

  const totalAmount = bodies.reduce((sum, body) => sum + body.amount, 0);
  const expectedAmount = model.density * sphereVolume(model);
  const centre = scale(
    bodies.reduce<Vec3>((sum, body) => add(sum, scale(body.position, body.amount)), [0, 0, 0]),
    1 / totalAmount,
  );
  const amounts = bodies.map((body) => body.amount);
  const meanAmount = totalAmount / bodies.length;
  const equalWeightSpread = Math.max(...amounts) - Math.min(...amounts);

  const reversed = [...bodies].reverse();
  const permuted = deterministicPermutation(bodies);
  let permutationW0Delta = 0;
  let permutationW1Delta = 0;
  let rotationW0Delta = 0;
  let rotationW1Delta = 0;
  const rotatedBodies = bodies.map((body) => ({
    ...body,
    position: rotateAxisAngle(body.position, ROTATION_AXIS, GLOBAL_ROTATION_ANGLE),
  }));

  for (const { probe } of probes) {
    const reference = evaluateD0SMicrobodies(probe, bodies);
    for (const reordered of [reversed, permuted]) {
      const sample = evaluateD0SMicrobodies(probe, reordered);
      permutationW0Delta = Math.max(permutationW0Delta, relativeError(sample.w0, reference.w0));
      permutationW1Delta = Math.max(permutationW1Delta, vectorRelativeError(sample.w1, reference.w1));
    }

    const rotatedProbe = rotateAxisAngle(probe, ROTATION_AXIS, GLOBAL_ROTATION_ANGLE);
    const rotatedSample = evaluateD0SMicrobodies(rotatedProbe, rotatedBodies);
    const expectedRotatedW1 = rotateAxisAngle(reference.w1, ROTATION_AXIS, GLOBAL_ROTATION_ANGLE);
    rotationW0Delta = Math.max(rotationW0Delta, relativeError(rotatedSample.w0, reference.w0));
    rotationW1Delta = Math.max(rotationW1Delta, vectorRelativeError(rotatedSample.w1, expectedRotatedW1));
  }

  return {
    definition,
    shellCounts,
    amountClosureResidual: totalAmount - expectedAmount,
    centreOfAmountResidualOverR: vectorNorm(centre) / model.radius,
    equalWeightSpreadOverMean: equalWeightSpread / meanAmount,
    maximumW0RelativeError: maximum(probeRows.map((row) => row.w0RelativeError)),
    maximumW1MagnitudeRelativeError: maximum(probeRows.map((row) => row.w1MagnitudeRelativeError)),
    maximumW1VectorRelativeError: maximum(probeRows.map((row) => row.w1VectorRelativeError)),
    maximumW0OrientationSpread,
    maximumW1OrientationSpread,
    permutationW0Delta,
    permutationW1Delta,
    rotationW0Delta,
    rotationW1Delta,
    multipoles: d0sMultipolePowers(bodies),
    worstW0Probe: worstRow(probeRows, (row) => row.w0RelativeError),
    worstW1Probe: worstRow(probeRows, (row) => row.w1MagnitudeRelativeError),
    worstVectorProbe: worstRow(probeRows, (row) => row.w1VectorRelativeError),
    probeRows,
  };
}

function maximumPermutationDelta(level: D0SLevelMetrics): number {
  return Math.max(level.permutationW0Delta, level.permutationW1Delta);
}

function maximumRotationDelta(level: D0SLevelMetrics): number {
  return Math.max(level.rotationW0Delta, level.rotationW1Delta);
}

function maximumOrientationSpread(level: D0SLevelMetrics): number {
  return Math.max(level.maximumW0OrientationSpread, level.maximumW1OrientationSpread);
}

export function runD0SParity(model: SphereModel = { radius: 1, density: 1 }): D0SParityResult {
  const levels = D0S_LEVELS.map((definition) => runD0SLevel(model, definition));
  const coarsest = levels[0]!;
  const finest = levels.at(-1)!;
  const vectorRefinementRatio = coarsest.maximumW1VectorRelativeError / finest.maximumW1VectorRelativeError;
  const orientationRefinementRatio = maximumOrientationSpread(coarsest) / maximumOrientationSpread(finest);

  const gates: D0SGateStatus[] = [
    { id: "G01", label: "finest max W0 relative error", value: finest.maximumW0RelativeError, threshold: 2.5e-3, pass: finest.maximumW0RelativeError <= 2.5e-3, comparison: "MAX" },
    { id: "G02", label: "finest max W1 magnitude relative error", value: finest.maximumW1MagnitudeRelativeError, threshold: 2.5e-3, pass: finest.maximumW1MagnitudeRelativeError <= 2.5e-3, comparison: "MAX" },
    { id: "G03", label: "finest max W1 vector relative error", value: finest.maximumW1VectorRelativeError, threshold: 3e-3, pass: finest.maximumW1VectorRelativeError <= 3e-3, comparison: "MAX" },
    { id: "G04", label: "finest max W0 orientation spread", value: finest.maximumW0OrientationSpread, threshold: 3e-3, pass: finest.maximumW0OrientationSpread <= 3e-3, comparison: "MAX" },
    { id: "G05", label: "finest max W1 orientation spread", value: finest.maximumW1OrientationSpread, threshold: 3e-3, pass: finest.maximumW1OrientationSpread <= 3e-3, comparison: "MAX" },
    { id: "G06", label: "finest COM residual / R", value: finest.centreOfAmountResidualOverR, threshold: 1e-14, pass: finest.centreOfAmountResidualOverR <= 1e-14, comparison: "MAX" },
    { id: "G07", label: "finest equal-weight spread / mean", value: finest.equalWeightSpreadOverMean, threshold: 1e-14, pass: finest.equalWeightSpreadOverMean <= 1e-14, comparison: "MAX" },
    { id: "G08", label: "finest permutation delta", value: maximumPermutationDelta(finest), threshold: 1e-13, pass: maximumPermutationDelta(finest) <= 1e-13, comparison: "MAX" },
    { id: "G09", label: "finest rotation covariance delta", value: maximumRotationDelta(finest), threshold: 1e-12, pass: maximumRotationDelta(finest) <= 1e-12, comparison: "MAX" },
    { id: "G10", label: "finest P1", value: finest.multipoles.l1, threshold: 1e-12, pass: finest.multipoles.l1 <= 1e-12, comparison: "MAX" },
    { id: "G11", label: "finest P2", value: finest.multipoles.l2, threshold: 3e-3, pass: finest.multipoles.l2 <= 3e-3, comparison: "MAX" },
    { id: "G12", label: "finest P3", value: finest.multipoles.l3, threshold: 1e-12, pass: finest.multipoles.l3 <= 1e-12, comparison: "MAX" },
    { id: "G13", label: "finest P4", value: finest.multipoles.l4, threshold: 6e-3, pass: finest.multipoles.l4 <= 6e-3, comparison: "MAX" },
    { id: "G14", label: "W1 vector refinement ratio", value: vectorRefinementRatio, threshold: 20, pass: vectorRefinementRatio > 20, comparison: "MIN_RATIO" },
    { id: "G15", label: "orientation-spread refinement ratio", value: orientationRefinementRatio, threshold: 20, pass: orientationRefinementRatio > 20, comparison: "MIN_RATIO" },
    { id: "G16", label: "P2 decreases N48 -> N3072", value: coarsest.multipoles.l2 / finest.multipoles.l2, threshold: 1, pass: finest.multipoles.l2 < coarsest.multipoles.l2, comparison: "DECREASE" },
    { id: "G17", label: "P4 decreases N48 -> N3072", value: coarsest.multipoles.l4 / finest.multipoles.l4, threshold: 1, pass: finest.multipoles.l4 < coarsest.multipoles.l4, comparison: "DECREASE" },
  ];

  const numericalValues = levels.flatMap((level) => [
    level.maximumW0RelativeError,
    level.maximumW1MagnitudeRelativeError,
    level.maximumW1VectorRelativeError,
    level.maximumW0OrientationSpread,
    level.maximumW1OrientationSpread,
    level.centreOfAmountResidualOverR,
    level.equalWeightSpreadOverMean,
    level.permutationW0Delta,
    level.permutationW1Delta,
    level.rotationW0Delta,
    level.rotationW1Delta,
    level.multipoles.l1,
    level.multipoles.l2,
    level.multipoles.l3,
    level.multipoles.l4,
  ]);
  const finite = numericalValues.every(Number.isFinite);
  const pass = finite && gates.every((gate) => gate.pass);
  const verdict = !finite
    ? "D0S_NUMERICAL_OR_PROVENANCE_BLOCKER"
    : pass
      ? "D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS"
      : "D0S_PACKING_OR_REFINEMENT_BLOCKER";

  return {
    schema: "VOXELLAB_D0S_STATIC_MICROBODY_PARITY_V1",
    model,
    levels,
    gates,
    verdict,
    d0mStatus: pass ? "OPEN_AFTER_D0S_PASS" : "CLOSED_BY_D0S_BLOCKER",
    claimCeiling: "STATIC_EQUAL_MICROBODY_REPRESENTATION_METHOD_PARITY_ONLY",
    firewalls: [
      "NO_DYNAMICS_IN_D0S",
      "NO_VOXEL_ELEMENT_AS_MOBILE_BODY_CLAIM",
      "NO_FINITE_SET_AS_EXACT_SO3_SPHERE",
      "NO_BACKGROUND_OR_REDIRECTION_IN_D0S",
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
