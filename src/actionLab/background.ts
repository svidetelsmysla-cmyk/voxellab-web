import {
  gaussLegendre,
  raySphereInterval,
  vectorNorm,
  type SphereModel,
  type Vec3,
} from "./math";

export interface IsotropicBackgroundModel {
  intensityPerSteradian: number;
}

export interface BackgroundLedger {
  incidentScalar: number;
  straightSurvivingScalar: number;
  straightDeficitScalar: number;
  deficitFraction: number;
  straightFraction: number;
  incidentVector: Vec3;
  straightSurvivingVector: Vec3;
  blockedIncidentVector: Vec3;
  residualFromDeficit: Vec3;
  residualMagnitude: number;
  capSolidAngle: number;
  angularRadius: number;
  scalarClosureResidual: number;
  vectorClosureResidual: number;
}

export interface RendererBackgroundLedger extends BackgroundLedger {
  sampleCount: number;
  hitCount: number;
  proposalSolidAngle: number;
  proposalAngularRadius: number;
}

const TAU = 2 * Math.PI;

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
  if (!(magnitude > 0)) throw new Error("Cannot normalize a zero vector");
  return scale(value, 1 / magnitude);
}

function requireFixture(probe: Vec3, sphere: SphereModel, background: IsotropicBackgroundModel): number {
  if (!(sphere.radius > 0)) throw new Error("Sphere radius must be positive");
  if (!(background.intensityPerSteradian > 0)) throw new Error("Background intensity must be positive");
  const distance = vectorNorm(probe);
  if (!(distance > sphere.radius)) throw new Error("A0.2 samples only exterior receiver probes");
  return distance;
}

function assembleLedger(
  axisToBody: Vec3,
  angularRadius: number,
  capSolidAngle: number,
  deficitScalar: number,
  deficitLookMoment: Vec3,
  background: IsotropicBackgroundModel,
): BackgroundLedger {
  const incidentScalar = 4 * Math.PI * background.intensityPerSteradian;
  const straightSurvivingScalar = incidentScalar - deficitScalar;
  const incidentVector: Vec3 = [0, 0, 0];

  // Omega is the receiver-centred outward look direction. Incoming action along
  // that route has orientation -Omega. Removing the blocked incoming moment
  // leaves a positive residual in the +Omega cap direction, toward the body.
  const straightSurvivingVector = deficitLookMoment;
  const blockedIncidentVector = scale(deficitLookMoment, -1);
  const residualFromDeficit = straightSurvivingVector;
  const scalarClosureResidual = Math.abs(
    incidentScalar - straightSurvivingScalar - deficitScalar,
  );
  const vectorClosureResidual = vectorNorm(
    subtract(incidentVector, add(straightSurvivingVector, blockedIncidentVector)),
  );

  const axialProjection = dot(residualFromDeficit, axisToBody);
  if (axialProjection < -1e-12) throw new Error("Background residual points away from the formed body");

  return {
    incidentScalar,
    straightSurvivingScalar,
    straightDeficitScalar: deficitScalar,
    deficitFraction: deficitScalar / incidentScalar,
    straightFraction: straightSurvivingScalar / incidentScalar,
    incidentVector,
    straightSurvivingVector,
    blockedIncidentVector,
    residualFromDeficit,
    residualMagnitude: vectorNorm(residualFromDeficit),
    capSolidAngle,
    angularRadius,
    scalarClosureResidual,
    vectorClosureResidual,
  };
}

export function analyticIsotropicSphereBackground(
  probe: Vec3,
  sphere: SphereModel,
  background: IsotropicBackgroundModel,
): BackgroundLedger {
  const distance = requireFixture(probe, sphere, background);
  const axisToBody = scale(probe, -1 / distance);
  const sine = sphere.radius / distance;
  const cosine = Math.sqrt(Math.max(0, 1 - sine ** 2));
  const angularRadius = Math.asin(sine);
  const capSolidAngle = TAU * (1 - cosine);
  const deficitScalar = background.intensityPerSteradian * capSolidAngle;
  const residualMagnitude = Math.PI * background.intensityPerSteradian * sine ** 2;
  return assembleLedger(
    axisToBody,
    angularRadius,
    capSolidAngle,
    deficitScalar,
    scale(axisToBody, residualMagnitude),
    background,
  );
}

export function curvedIsotropicSphereBackground(
  probe: Vec3,
  sphere: SphereModel,
  background: IsotropicBackgroundModel,
  order = 96,
): BackgroundLedger {
  const distance = requireFixture(probe, sphere, background);
  const axisToBody = scale(probe, -1 / distance);
  const angularRadius = Math.asin(sphere.radius / distance);
  const { nodes, weights } = gaussLegendre(order);
  let scalarIntegral = 0;
  let axialIntegral = 0;
  for (let index = 0; index < order; index += 1) {
    const node = nodes[index];
    const weight = weights[index];
    if (node === undefined || weight === undefined) throw new Error("Incomplete Gauss-Legendre rule");
    const theta = 0.5 * angularRadius * (node + 1);
    scalarIntegral += weight * Math.sin(theta);
    axialIntegral += weight * Math.cos(theta) * Math.sin(theta);
  }
  const factor = Math.PI * angularRadius * background.intensityPerSteradian;
  const deficitScalar = factor * scalarIntegral;
  const residualMagnitude = factor * axialIntegral;
  const capSolidAngle = deficitScalar / background.intensityPerSteradian;
  return assembleLedger(
    axisToBody,
    angularRadius,
    capSolidAngle,
    deficitScalar,
    scale(axisToBody, residualMagnitude),
    background,
  );
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

export function rendererIsotropicSphereBackground(
  probe: Vec3,
  sphere: SphereModel,
  background: IsotropicBackgroundModel,
  sampleCount = 4096,
  proposalScale = 1.35,
): RendererBackgroundLedger {
  const distance = requireFixture(probe, sphere, background);
  if (!Number.isInteger(sampleCount) || sampleCount < 256) {
    throw new Error("Renderer background sample count must be an integer >= 256");
  }
  if (!(proposalScale >= 1)) throw new Error("Proposal scale must contain the full body silhouette");

  const axisToBody = scale(probe, -1 / distance);
  const angularRadius = Math.asin(sphere.radius / distance);
  const proposalAngularRadius = Math.min(Math.PI / 2, proposalScale * angularRadius);
  const proposalCosine = Math.cos(proposalAngularRadius);
  const proposalSolidAngle = TAU * (1 - proposalCosine);
  const sampleWeight = background.intensityPerSteradian * proposalSolidAngle / sampleCount;
  const [tangent, bitangent] = orthonormalBasis(axisToBody);

  let deficitScalar = 0;
  let deficitLookMoment: Vec3 = [0, 0, 0];
  let hitCount = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const u = (index + 0.5) / sampleCount;
    const v = radicalInverseVanDerCorput(index);
    const cosTheta = 1 - u * (1 - proposalCosine);
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta ** 2));
    const phi = TAU * v;
    const direction = add(
      scale(axisToBody, cosTheta),
      add(
        scale(tangent, sinTheta * Math.cos(phi)),
        scale(bitangent, sinTheta * Math.sin(phi)),
      ),
    );
    if (!raySphereInterval(probe, direction, sphere.radius)) continue;
    deficitScalar += sampleWeight;
    deficitLookMoment = add(deficitLookMoment, scale(direction, sampleWeight));
    hitCount += 1;
  }

  const ledger = assembleLedger(
    axisToBody,
    angularRadius,
    deficitScalar / background.intensityPerSteradian,
    deficitScalar,
    deficitLookMoment,
    background,
  );
  return {
    ...ledger,
    sampleCount,
    hitCount,
    proposalSolidAngle,
    proposalAngularRadius,
  };
}

export function backgroundRelativeError(value: number, reference: number): number {
  if (reference === 0) return value === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(value - reference) / Math.abs(reference);
}
