import {
  backgroundExteriorChannels,
  bodyW0UniformSphere,
  matchedOutgoingCoefficient,
  matchedUniformSourceDensity,
  sphereVolumeFromRadius,
} from "./closure";
import { createVolumeCubature, gaussLegendre, type SphereModel, type Vec3 } from "./math";

export interface ExtendedReceiverModel {
  sourceRadius: number;
  receiverRadius: number;
  separation: number;
  backgroundIntensityPerSteradian: number;
  sourceToMatchedRatio: number;
  receiverDensity: number;
}

export interface ExtendedReceiverReadout {
  bodyW0: number;
  backgroundIncident: number;
  backgroundStraightSurviving: number;
  backgroundStraightDeficit: number;
  directW1: Vec3;
  backgroundW1: Vec3;
  netW1: Vec3;
  directTorque: Vec3;
  backgroundTorque: Vec3;
  netTorque: Vec3;
}

export interface ExtendedReceiverParity {
  analyticDirectMagnitude: number;
  shellDirectMagnitude: number;
  cubatureDirectMagnitude: number;
  analyticBackgroundMagnitude: number;
  shellBackgroundMagnitude: number;
  cubatureBackgroundMagnitude: number;
  shellDirectRelativeError: number;
  cubatureDirectRelativeError: number;
  shellBackgroundRelativeError: number;
  cubatureBackgroundRelativeError: number;
  cubatureBodyW0RelativeError: number;
  cubatureDeficitRelativeError: number;
  normalizedTorque: number;
}

const FOUR_PI = 4 * Math.PI;

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

export function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function receiverAmount(model: ExtendedReceiverModel): number {
  return model.receiverDensity * sphereVolumeFromRadius(model.receiverRadius);
}

export function sourceCoefficient(model: ExtendedReceiverModel): number {
  return matchedOutgoingCoefficient(model.sourceRadius, model.backgroundIntensityPerSteradian);
}

export function requireA1Model(model: ExtendedReceiverModel): void {
  const {
    sourceRadius,
    receiverRadius,
    separation,
    backgroundIntensityPerSteradian,
    sourceToMatchedRatio,
    receiverDensity,
  } = model;
  if (!(sourceRadius > 0 && receiverRadius > 0 && backgroundIntensityPerSteradian > 0 && receiverDensity > 0)) {
    throw new Error("A1 radii, background intensity and receiver density must be positive");
  }
  if (!(sourceToMatchedRatio >= 0)) throw new Error("A1 source ratio must be non-negative");
  if (separation + 1e-12 < sourceRadius + receiverRadius) {
    throw new Error("A1 permits contact but not source/receiver overlap");
  }
}

export function analyticExtendedReceiver(model: ExtendedReceiverModel): ExtendedReceiverReadout {
  requireA1Model(model);
  const amount = receiverAmount(model);
  const coefficient = sourceCoefficient(model);
  const baseMagnitude = coefficient * amount / model.separation ** 2;
  const directW1: Vec3 = [model.sourceToMatchedRatio * baseMagnitude, 0, 0];
  const backgroundW1: Vec3 = [-baseMagnitude, 0, 0];
  const netW1 = add(directW1, backgroundW1);
  const zero: Vec3 = [0, 0, 0];
  return {
    bodyW0: Number.NaN,
    backgroundIncident: FOUR_PI * model.backgroundIntensityPerSteradian * amount,
    backgroundStraightSurviving: Number.NaN,
    backgroundStraightDeficit: Number.NaN,
    directW1,
    backgroundW1,
    netW1,
    directTorque: zero,
    backgroundTorque: zero,
    netTorque: zero,
  };
}

function integrateInterval(
  lower: number,
  upper: number,
  order: number,
  integrand: (radius: number) => number,
): number {
  const { nodes, weights } = gaussLegendre(order);
  const midpoint = 0.5 * (lower + upper);
  const halfWidth = 0.5 * (upper - lower);
  let total = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const weight = weights[index];
    if (node === undefined || weight === undefined) throw new Error("Incomplete Gauss rule");
    total += weight * integrand(midpoint + halfWidth * node);
  }
  return halfWidth * total;
}

export function integrateReceiverRadialScalar(
  model: ExtendedReceiverModel,
  radialScalar: (distance: number) => number,
  order = 96,
): number {
  requireA1Model(model);
  const d = model.separation;
  const a = model.receiverRadius;
  const lower = d - a;
  const upper = d + a;
  return model.receiverDensity * integrateInterval(lower, upper, order, distance => {
    const capWeight = Math.PI * distance * (a ** 2 - (distance - d) ** 2) / d;
    return capWeight * radialScalar(distance);
  });
}

export function integrateReceiverRadialVector(
  model: ExtendedReceiverModel,
  radialMagnitude: (distance: number) => number,
  order = 96,
): Vec3 {
  requireA1Model(model);
  const d = model.separation;
  const a = model.receiverRadius;
  const lower = d - a;
  const upper = d + a;
  const axial = model.receiverDensity * integrateInterval(lower, upper, order, distance => {
    const cosine = (distance ** 2 + d ** 2 - a ** 2) / (2 * distance * d);
    const sineSquared = Math.max(0, 1 - cosine ** 2);
    return Math.PI * distance ** 2 * radialMagnitude(distance) * sineSquared;
  });
  return [axial, 0, 0];
}

export function shellIntegratedExtendedReceiver(model: ExtendedReceiverModel, order = 96): ExtendedReceiverReadout {
  requireA1Model(model);
  const coefficient = sourceCoefficient(model);
  const sourceDensity = matchedUniformSourceDensity(
    model.sourceRadius,
    model.backgroundIntensityPerSteradian,
  ) * model.sourceToMatchedRatio;
  const sourceSphere: SphereModel = { radius: model.sourceRadius, density: sourceDensity };
  const bodyW0 = integrateReceiverRadialScalar(model, distance => bodyW0UniformSphere(distance, sourceSphere), order);
  const backgroundIncident = FOUR_PI * model.backgroundIntensityPerSteradian * receiverAmount(model);
  const backgroundStraightDeficit = integrateReceiverRadialScalar(model, distance => {
    const channels = backgroundExteriorChannels(
      distance,
      model.sourceRadius,
      model.backgroundIntensityPerSteradian,
    );
    if (!channels) throw new Error("A1 shell integral entered unsupported source interior");
    return channels.deficit;
  }, order);
  const backgroundStraightSurviving = backgroundIncident - backgroundStraightDeficit;
  const directW1 = integrateReceiverRadialVector(
    model,
    distance => model.sourceToMatchedRatio * coefficient / distance ** 2,
    order,
  );
  const backgroundOutwardMagnitude = integrateReceiverRadialVector(
    model,
    distance => coefficient / distance ** 2,
    order,
  );
  const backgroundW1 = scale(backgroundOutwardMagnitude, -1);
  const netW1 = add(directW1, backgroundW1);
  const zero: Vec3 = [0, 0, 0];
  return {
    bodyW0,
    backgroundIncident,
    backgroundStraightSurviving,
    backgroundStraightDeficit,
    directW1,
    backgroundW1,
    netW1,
    directTorque: zero,
    backgroundTorque: zero,
    netTorque: zero,
  };
}

export function cubatureExtendedReceiver(
  model: ExtendedReceiverModel,
  radialShells = 16,
  angularSamples = 1024,
): ExtendedReceiverReadout {
  requireA1Model(model);
  const coefficient = sourceCoefficient(model);
  const sourceDensity = matchedUniformSourceDensity(
    model.sourceRadius,
    model.backgroundIntensityPerSteradian,
  ) * model.sourceToMatchedRatio;
  const sourceSphere: SphereModel = { radius: model.sourceRadius, density: sourceDensity };
  const receiverSphere: SphereModel = { radius: model.receiverRadius, density: 1 };
  const cubature = createVolumeCubature(receiverSphere, radialShells, angularSamples);
  const weightedReceiverVolume = model.receiverDensity * cubature.sampleVolume;
  let bodyW0 = 0;
  let backgroundStraightDeficit = 0;
  let directW1: Vec3 = [0, 0, 0];
  let backgroundW1: Vec3 = [0, 0, 0];
  let directTorque: Vec3 = [0, 0, 0];
  let backgroundTorque: Vec3 = [0, 0, 0];

  for (const local of cubature.points) {
    const point: Vec3 = [model.separation + local[0], local[1], local[2]];
    const distance = norm(point);
    if (distance + 1e-12 < model.sourceRadius) {
      throw new Error("A1 cubature entered unsupported source interior");
    }
    const inverseCube = 1 / distance ** 3;
    const directLocal = scale(point, model.sourceToMatchedRatio * coefficient * inverseCube);
    const backgroundLocal = scale(point, -coefficient * inverseCube);
    const directTransfer = scale(directLocal, weightedReceiverVolume);
    const backgroundTransfer = scale(backgroundLocal, weightedReceiverVolume);
    directW1 = add(directW1, directTransfer);
    backgroundW1 = add(backgroundW1, backgroundTransfer);
    directTorque = add(directTorque, cross(local, directTransfer));
    backgroundTorque = add(backgroundTorque, cross(local, backgroundTransfer));
    bodyW0 += weightedReceiverVolume * bodyW0UniformSphere(distance, sourceSphere);
    const channels = backgroundExteriorChannels(
      distance,
      model.sourceRadius,
      model.backgroundIntensityPerSteradian,
    );
    if (!channels) throw new Error("A1 cubature background channel entered source interior");
    backgroundStraightDeficit += weightedReceiverVolume * channels.deficit;
  }

  const backgroundIncident = FOUR_PI * model.backgroundIntensityPerSteradian * receiverAmount(model);
  const backgroundStraightSurviving = backgroundIncident - backgroundStraightDeficit;
  return {
    bodyW0,
    backgroundIncident,
    backgroundStraightSurviving,
    backgroundStraightDeficit,
    directW1,
    backgroundW1,
    netW1: add(directW1, backgroundW1),
    directTorque,
    backgroundTorque,
    netTorque: add(directTorque, backgroundTorque),
  };
}

function relativeError(value: number, reference: number): number {
  if (reference === 0) return value === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(value - reference) / Math.abs(reference);
}

export function extendedReceiverParity(model: ExtendedReceiverModel): ExtendedReceiverParity {
  const analytic = analyticExtendedReceiver(model);
  const shell = shellIntegratedExtendedReceiver(model);
  const cubature = cubatureExtendedReceiver(model);
  const analyticDirectMagnitude = norm(analytic.directW1);
  const analyticBackgroundMagnitude = norm(analytic.backgroundW1);
  const shellDirectMagnitude = norm(shell.directW1);
  const shellBackgroundMagnitude = norm(shell.backgroundW1);
  const cubatureDirectMagnitude = norm(cubature.directW1);
  const cubatureBackgroundMagnitude = norm(cubature.backgroundW1);
  const torqueScale = Math.max(analyticDirectMagnitude * model.receiverRadius, 1e-30);
  return {
    analyticDirectMagnitude,
    shellDirectMagnitude,
    cubatureDirectMagnitude,
    analyticBackgroundMagnitude,
    shellBackgroundMagnitude,
    cubatureBackgroundMagnitude,
    shellDirectRelativeError: relativeError(shellDirectMagnitude, analyticDirectMagnitude),
    cubatureDirectRelativeError: relativeError(cubatureDirectMagnitude, analyticDirectMagnitude),
    shellBackgroundRelativeError: relativeError(shellBackgroundMagnitude, analyticBackgroundMagnitude),
    cubatureBackgroundRelativeError: relativeError(cubatureBackgroundMagnitude, analyticBackgroundMagnitude),
    cubatureBodyW0RelativeError: relativeError(cubature.bodyW0, shell.bodyW0),
    cubatureDeficitRelativeError: relativeError(
      cubature.backgroundStraightDeficit,
      shell.backgroundStraightDeficit,
    ),
    normalizedTorque: norm(cubature.netTorque) / torqueScale,
  };
}

export function localExtendedReceiverChannels(
  point: Vec3,
  model: ExtendedReceiverModel,
): {
  direct: Vec3;
  background: Vec3;
  net: Vec3;
  bodyW0: number;
  deficit: number;
} {
  requireA1Model(model);
  const distance = norm(point);
  if (distance + 1e-12 < model.sourceRadius) throw new Error("A1 local point entered source interior");
  const coefficient = sourceCoefficient(model);
  const direct = scale(point, model.sourceToMatchedRatio * coefficient / distance ** 3);
  const background = scale(point, -coefficient / distance ** 3);
  const sourceSphere: SphereModel = {
    radius: model.sourceRadius,
    density: matchedUniformSourceDensity(
      model.sourceRadius,
      model.backgroundIntensityPerSteradian,
    ) * model.sourceToMatchedRatio,
  };
  const channels = backgroundExteriorChannels(
    distance,
    model.sourceRadius,
    model.backgroundIntensityPerSteradian,
  );
  if (!channels) throw new Error("A1 local background point entered source interior");
  return {
    direct,
    background,
    net: add(direct, background),
    bodyW0: bodyW0UniformSphere(distance, sourceSphere),
    deficit: channels.deficit,
  };
}
