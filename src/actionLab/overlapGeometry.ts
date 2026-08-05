import {
  backgroundExteriorChannels,
  bodyW0UniformSphere,
  matchedOutgoingCoefficient,
  matchedUniformSourceDensity,
  sphereVolumeFromRadius,
} from "./closure";
import { createVolumeCubature, gaussLegendre, type Vec3 } from "./math";

export interface EqualSphereOverlapModel {
  radius: number;
  separation: number;
  backgroundIntensityPerSteradian: number;
  receiverDensity: number;
}

export interface OverlapLedger {
  sphereVolume: number;
  overlapVolume: number;
  unionOccupiedVolume: number;
  compensationAmount: number;
  sourceExclusiveVolume: number;
  receiverExclusiveVolume: number;
  overlapFirstMomentX: number;
  overlapCentroidX: number;
  amountClosureResidual: number;
}

export interface OverlapReadout {
  directW1: Vec3;
  backgroundW1: Vec3;
  dualMembershipNetW1: Vec3;
  dualMembershipTorque: Vec3;
  bodyW0: number;
  incidentW0: number;
  survivingW0: number;
  deficitW0: number;
  resolvedUnifiedExclusiveW1: Vec3;
  unresolvedCompensationAmount: number;
  overlapVolumeEstimate?: number;
  overlapFirstMomentEstimate?: number;
}

export interface OverlapParity {
  exactNetMagnitude: number;
  shellNetMagnitude: number;
  cubatureNetMagnitude: number;
  shellRelativeError: number;
  cubatureRelativeError: number;
  overlapVolumeRelativeError: number;
  overlapFirstMomentRelativeError: number;
  normalizedTorque: number;
}

const FOUR_PI = 4 * Math.PI;
const EPS = 1e-12;

function requireModel(model: EqualSphereOverlapModel): void {
  if (!(model.radius > 0)) throw new Error("A2 radius must be positive");
  if (!(model.separation >= 0)) throw new Error("A2 separation must be non-negative");
  if (!(model.backgroundIntensityPerSteradian > 0)) throw new Error("A2 background intensity must be positive");
  if (!(model.receiverDensity > 0)) throw new Error("A2 receiver density must be positive");
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function equalSphereOverlapVolume(radius: number, separation: number): number {
  if (!(radius > 0) || !(separation >= 0)) throw new Error("Invalid equal-sphere overlap geometry");
  if (separation >= 2 * radius) return 0;
  return Math.PI * (4 * radius + separation) * (2 * radius - separation) ** 2 / 12;
}

export function equalSphereOverlapFirstMomentX(radius: number, separation: number): number {
  // Equal-sphere intersection is mirror-symmetric about x=d/2.
  return 0.5 * separation * equalSphereOverlapVolume(radius, separation);
}

export function overlapLedger(model: EqualSphereOverlapModel): OverlapLedger {
  requireModel(model);
  const sphereVolume = sphereVolumeFromRadius(model.radius);
  const overlapVolume = equalSphereOverlapVolume(model.radius, model.separation);
  const overlapFirstMomentX = equalSphereOverlapFirstMomentX(model.radius, model.separation);
  const unionOccupiedVolume = 2 * sphereVolume - overlapVolume;
  const compensationAmount = overlapVolume;
  const amountClosureResidual = unionOccupiedVolume + compensationAmount - 2 * sphereVolume;
  return {
    sphereVolume,
    overlapVolume,
    unionOccupiedVolume,
    compensationAmount,
    sourceExclusiveVolume: sphereVolume - overlapVolume,
    receiverExclusiveVolume: sphereVolume - overlapVolume,
    overlapFirstMomentX,
    overlapCentroidX: overlapVolume > 0 ? overlapFirstMomentX / overlapVolume : 0,
    amountClosureResidual,
  };
}

export function overlapContactReference(model: EqualSphereOverlapModel): number {
  requireModel(model);
  const coefficient = matchedOutgoingCoefficient(model.radius, model.backgroundIntensityPerSteradian);
  const receiverAmount = model.receiverDensity * sphereVolumeFromRadius(model.radius);
  return coefficient * receiverAmount / (2 * model.radius) ** 2;
}

export function exactDualMembershipNetMagnitude(model: EqualSphereOverlapModel): number {
  requireModel(model);
  const coefficient = matchedOutgoingCoefficient(model.radius, model.backgroundIntensityPerSteradian);
  return coefficient * model.receiverDensity * equalSphereOverlapFirstMomentX(
    model.radius,
    model.separation,
  ) / model.radius ** 3;
}

export function normalizedDualMembershipCurve(separationRatio: number): number {
  if (!(separationRatio >= 0)) throw new Error("separationRatio must be non-negative");
  if (separationRatio >= 2) return 0;
  const x = separationRatio / 2;
  return 2 * x * (2 + x) * (1 - x) ** 2;
}

export const DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO = Math.sqrt(3) - 1;
export const DUAL_MEMBERSHIP_PEAK_NORMALIZED = -4.5 + 3 * Math.sqrt(3);

interface CapMoments {
  solidAngle: number;
  axialFirstMoment: number;
}

function receiverCapMoments(radiusFromSource: number, model: EqualSphereOverlapModel): CapMoments {
  const R = model.radius;
  const d = model.separation;
  if (radiusFromSource < 0) throw new Error("radiusFromSource must be non-negative");
  if (d <= EPS) {
    return radiusFromSource <= R ? { solidAngle: FOUR_PI, axialFirstMoment: 0 } : { solidAngle: 0, axialFirstMoment: 0 };
  }
  if (radiusFromSource + d <= R + EPS) return { solidAngle: FOUR_PI, axialFirstMoment: 0 };
  if (radiusFromSource >= d + R - EPS || d >= radiusFromSource + R - EPS) {
    return { solidAngle: 0, axialFirstMoment: 0 };
  }
  const denominator = 2 * radiusFromSource * d;
  if (!(denominator > 0)) return { solidAngle: 0, axialFirstMoment: 0 };
  const mu = Math.max(-1, Math.min(1,
    (radiusFromSource ** 2 + d ** 2 - R ** 2) / denominator,
  ));
  return {
    solidAngle: 2 * Math.PI * (1 - mu),
    axialFirstMoment: Math.PI * (1 - mu ** 2),
  };
}

function integrateGauss(
  start: number,
  end: number,
  order: number,
  callback: (radius: number, weight: number) => void,
): void {
  if (!(end > start)) return;
  const rule = gaussLegendre(order);
  const half = 0.5 * (end - start);
  const middle = 0.5 * (end + start);
  for (let index = 0; index < order; index += 1) {
    const node = rule.nodes[index];
    const weight = rule.weights[index];
    if (node === undefined || weight === undefined) throw new Error("Incomplete Gauss rule");
    callback(middle + half * node, half * weight);
  }
}

export function shellIntegratedOverlap(
  model: EqualSphereOverlapModel,
  order = 96,
): OverlapReadout {
  requireModel(model);
  const R = model.radius;
  const d = model.separation;
  const I = model.backgroundIntensityPerSteradian;
  const qr = model.receiverDensity;
  const coefficient = matchedOutgoingCoefficient(R, I);
  const sourceSphere = {
    radius: R,
    density: matchedUniformSourceDensity(R, I),
  };

  let directX = 0;
  let backgroundX = 0;
  let bodyW0 = 0;
  let incidentW0 = 0;
  let survivingW0 = 0;
  let deficitW0 = 0;

  const boundaries = [0, Math.abs(R - d), R, d + R]
    .filter(value => value >= 0 && value <= d + R + EPS)
    .sort((a, b) => a - b)
    .filter((value, index, values) => index === 0 || Math.abs(value - (values[index - 1] ?? 0)) > EPS);

  for (let interval = 0; interval + 1 < boundaries.length; interval += 1) {
    const start = boundaries[interval] ?? 0;
    const end = boundaries[interval + 1] ?? start;
    integrateGauss(start, end, order, (r, radialWeight) => {
      const cap = receiverCapMoments(r, model);
      if (cap.solidAngle === 0) return;
      const volumeScale = qr * r ** 2 * radialWeight;
      const directMagnitude = r < R
        ? coefficient * r / R ** 3
        : coefficient / Math.max(r ** 2, Number.MIN_VALUE);
      const backgroundMagnitude = r < R
        ? 0
        : coefficient / Math.max(r ** 2, Number.MIN_VALUE);
      directX += directMagnitude * volumeScale * cap.axialFirstMoment;
      backgroundX -= backgroundMagnitude * volumeScale * cap.axialFirstMoment;

      bodyW0 += bodyW0UniformSphere(r, sourceSphere) * volumeScale * cap.solidAngle;
      const incidentAtPoint = FOUR_PI * I;
      let deficitAtPoint: number;
      let survivingAtPoint: number;
      if (r < R) {
        // Opaque first-hit limiting control: all external straight directions are unavailable.
        deficitAtPoint = incidentAtPoint;
        survivingAtPoint = 0;
      } else {
        const background = backgroundExteriorChannels(r, R, I);
        if (!background) throw new Error("Missing exterior background channels");
        deficitAtPoint = background.deficit;
        survivingAtPoint = background.surviving;
      }
      incidentW0 += incidentAtPoint * volumeScale * cap.solidAngle;
      deficitW0 += deficitAtPoint * volumeScale * cap.solidAngle;
      survivingW0 += survivingAtPoint * volumeScale * cap.solidAngle;
    });
  }

  return {
    directW1: [directX, 0, 0],
    backgroundW1: [backgroundX, 0, 0],
    dualMembershipNetW1: [directX + backgroundX, 0, 0],
    dualMembershipTorque: [0, 0, 0],
    bodyW0,
    incidentW0,
    survivingW0,
    deficitW0,
    resolvedUnifiedExclusiveW1: [0, 0, 0],
    unresolvedCompensationAmount: overlapLedger(model).compensationAmount * qr,
  };
}

export function cubatureOverlap(
  model: EqualSphereOverlapModel,
  radialShells = 20,
  angularSamples = 1536,
): OverlapReadout {
  requireModel(model);
  const R = model.radius;
  const d = model.separation;
  const I = model.backgroundIntensityPerSteradian;
  const qr = model.receiverDensity;
  const coefficient = matchedOutgoingCoefficient(R, I);
  const sourceSphere = {
    radius: R,
    density: matchedUniformSourceDensity(R, I),
  };
  const receiverCubature = createVolumeCubature({ radius: R, density: 1 }, radialShells, angularSamples);
  const weightedVolume = qr * receiverCubature.sampleVolume;
  let directW1: Vec3 = [0, 0, 0];
  let backgroundW1: Vec3 = [0, 0, 0];
  let netTorque: Vec3 = [0, 0, 0];
  let bodyW0 = 0;
  let incidentW0 = 0;
  let survivingW0 = 0;
  let deficitW0 = 0;
  let overlapVolumeEstimate = 0;
  let overlapFirstMomentEstimate = 0;

  for (const local of receiverCubature.points) {
    const world: Vec3 = [d + local[0], local[1], local[2]];
    const r = norm(world);
    const insideSource = r < R;
    const direct = insideSource
      ? scale(world, coefficient / R ** 3)
      : scale(world, coefficient / Math.max(r ** 3, Number.MIN_VALUE));
    const background = insideSource
      ? ([0, 0, 0] as Vec3)
      : scale(world, -coefficient / Math.max(r ** 3, Number.MIN_VALUE));
    const net = add(direct, background);
    directW1 = add(directW1, scale(direct, weightedVolume));
    backgroundW1 = add(backgroundW1, scale(background, weightedVolume));
    netTorque = add(netTorque, scale(cross(local, net), weightedVolume));

    bodyW0 += bodyW0UniformSphere(r, sourceSphere) * weightedVolume;
    const incidentAtPoint = FOUR_PI * I;
    let deficitAtPoint: number;
    let survivingAtPoint: number;
    if (insideSource) {
      deficitAtPoint = incidentAtPoint;
      survivingAtPoint = 0;
      overlapVolumeEstimate += receiverCubature.sampleVolume;
      overlapFirstMomentEstimate += world[0] * receiverCubature.sampleVolume;
    } else {
      const channels = backgroundExteriorChannels(r, R, I);
      if (!channels) throw new Error("Missing cubature exterior background channels");
      deficitAtPoint = channels.deficit;
      survivingAtPoint = channels.surviving;
    }
    incidentW0 += incidentAtPoint * weightedVolume;
    deficitW0 += deficitAtPoint * weightedVolume;
    survivingW0 += survivingAtPoint * weightedVolume;
  }

  return {
    directW1,
    backgroundW1,
    dualMembershipNetW1: add(directW1, backgroundW1),
    dualMembershipTorque: netTorque,
    bodyW0,
    incidentW0,
    survivingW0,
    deficitW0,
    resolvedUnifiedExclusiveW1: [0, 0, 0],
    unresolvedCompensationAmount: overlapLedger(model).compensationAmount * qr,
    overlapVolumeEstimate,
    overlapFirstMomentEstimate,
  };
}

function relativeError(value: number, reference: number): number {
  if (Math.abs(reference) <= 1e-15) return Math.abs(value);
  return Math.abs(value - reference) / Math.abs(reference);
}

export function overlapParity(model: EqualSphereOverlapModel): OverlapParity {
  const exact = exactDualMembershipNetMagnitude(model);
  const shell = shellIntegratedOverlap(model);
  const cubature = cubatureOverlap(model);
  const ledger = overlapLedger(model);
  const shellMagnitude = norm(shell.dualMembershipNetW1);
  const cubatureMagnitude = norm(cubature.dualMembershipNetW1);
  const torqueScale = Math.max(overlapContactReference(model) * model.radius, 1e-30);
  return {
    exactNetMagnitude: exact,
    shellNetMagnitude: shellMagnitude,
    cubatureNetMagnitude: cubatureMagnitude,
    shellRelativeError: relativeError(shellMagnitude, exact),
    cubatureRelativeError: relativeError(cubatureMagnitude, exact),
    overlapVolumeRelativeError: relativeError(cubature.overlapVolumeEstimate ?? 0, ledger.overlapVolume),
    overlapFirstMomentRelativeError: relativeError(
      cubature.overlapFirstMomentEstimate ?? 0,
      ledger.overlapFirstMomentX,
    ),
    normalizedTorque: norm(cubature.dualMembershipTorque) / torqueScale,
  };
}

export function localOverlapChannels(point: Vec3, model: EqualSphereOverlapModel): {
  insideSource: boolean;
  insideReceiver: boolean;
  membership: "OUTSIDE" | "SOURCE_ONLY" | "RECEIVER_ONLY" | "SHARED_OCCUPIED";
  direct: Vec3;
  background: Vec3;
  dualMembershipNet: Vec3;
  governedUnifiedResolved: Vec3 | null;
} {
  requireModel(model);
  const R = model.radius;
  const d = model.separation;
  const I = model.backgroundIntensityPerSteradian;
  const coefficient = matchedOutgoingCoefficient(R, I);
  const rSource = norm(point);
  const receiverLocal: Vec3 = [point[0] - d, point[1], point[2]];
  const rReceiver = norm(receiverLocal);
  const insideSource = rSource <= R;
  const insideReceiver = rReceiver <= R;
  let membership: "OUTSIDE" | "SOURCE_ONLY" | "RECEIVER_ONLY" | "SHARED_OCCUPIED" = "OUTSIDE";
  if (insideSource && insideReceiver) membership = "SHARED_OCCUPIED";
  else if (insideSource) membership = "SOURCE_ONLY";
  else if (insideReceiver) membership = "RECEIVER_ONLY";

  const direct = insideSource
    ? scale(point, coefficient / R ** 3)
    : scale(point, coefficient / Math.max(rSource ** 3, Number.MIN_VALUE));
  const background = insideSource
    ? ([0, 0, 0] as Vec3)
    : scale(point, -coefficient / Math.max(rSource ** 3, Number.MIN_VALUE));
  const dualMembershipNet = add(direct, background);
  const governedUnifiedResolved = membership === "SHARED_OCCUPIED"
    ? null
    : insideReceiver ? dualMembershipNet : ([0, 0, 0] as Vec3);
  return {
    insideSource,
    insideReceiver,
    membership,
    direct,
    background,
    dualMembershipNet,
    governedUnifiedResolved,
  };
}
