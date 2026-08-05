import type { SphereModel } from "./math";

export interface ClosureModel {
  radius: number;
  backgroundIntensityPerSteradian: number;
  sourceToMatchedRatio: number;
}

export interface ScalarChannels {
  radiusRatio: number;
  bodyW0: number;
  bodyW1Magnitude: number;
  backgroundIncident: number | null;
  backgroundStraightSurviving: number | null;
  backgroundStraightDeficit: number | null;
  backgroundResidualMagnitude: number | null;
  directBodyOutgoingSigned: number;
  externalBackgroundResidualSigned: number | null;
  netDirectionalSigned: number | null;
}

const FOUR_PI = 4 * Math.PI;
const TWO_PI = 2 * Math.PI;

export function sphereVolumeFromRadius(radius: number): number {
  if (!(radius > 0)) throw new Error("radius must be positive");
  return (4 / 3) * Math.PI * radius ** 3;
}

export function bodyW0UniformSphere(distance: number, sphere: SphereModel): number {
  const { radius, density } = sphere;
  if (!(radius > 0) || !(density > 0)) throw new Error("sphere radius and density must be positive");
  if (!(distance >= 0)) throw new Error("distance must be non-negative");
  if (distance === 0) return FOUR_PI * density * radius;
  const scale = Math.max(radius, distance);
  if (Math.abs(distance - radius) <= 1e-12 * scale) return TWO_PI * density * radius;
  const logarithm = Math.log((distance + radius) / Math.abs(distance - radius));
  return TWO_PI * density * (
    radius + (radius ** 2 - distance ** 2) * logarithm / (2 * distance)
  );
}

export function bodyW1UniformSphere(distance: number, sphere: SphereModel): number {
  const { radius, density } = sphere;
  if (!(radius > 0) || !(density > 0)) throw new Error("sphere radius and density must be positive");
  if (!(distance >= 0)) throw new Error("distance must be non-negative");
  if (distance <= radius) return (FOUR_PI / 3) * density * distance;
  return density * sphereVolumeFromRadius(radius) / distance ** 2;
}

export function backgroundExteriorChannels(
  distance: number,
  radius: number,
  intensityPerSteradian: number,
): {
  incident: number;
  surviving: number;
  deficit: number;
  residualMagnitude: number;
} | null {
  if (!(radius > 0) || !(intensityPerSteradian > 0)) {
    throw new Error("radius and background intensity must be positive");
  }
  if (!(distance >= 0)) throw new Error("distance must be non-negative");
  if (distance < radius) return null;
  const ratio = radius / distance;
  const cosine = Math.sqrt(Math.max(0, 1 - ratio ** 2));
  const incident = FOUR_PI * intensityPerSteradian;
  const deficit = TWO_PI * intensityPerSteradian * (1 - cosine);
  const surviving = incident - deficit;
  const residualMagnitude = Math.PI * intensityPerSteradian * ratio ** 2;
  return { incident, surviving, deficit, residualMagnitude };
}

export function totalAcceptedIsotropicAction(radius: number, intensityPerSteradian: number): number {
  if (!(radius > 0) || !(intensityPerSteradian > 0)) {
    throw new Error("radius and background intensity must be positive");
  }
  // Integral over a surface point: ∫_hemisphere I cos(theta) dOmega = pi I.
  // Multiply by sphere surface area 4*pi*R^2.
  return 4 * Math.PI ** 2 * intensityPerSteradian * radius ** 2;
}

export function matchedOutgoingCoefficient(radius: number, intensityPerSteradian: number): number {
  // Conditional closure: full acceptance, stationary balance, no storage/loss,
  // and isotropic redistribution over 4*pi.
  return totalAcceptedIsotropicAction(radius, intensityPerSteradian) / FOUR_PI;
}

export function matchedUniformSourceDensity(radius: number, intensityPerSteradian: number): number {
  return matchedOutgoingCoefficient(radius, intensityPerSteradian) / sphereVolumeFromRadius(radius);
}

export function oneBodyClosureSample(distance: number, model: ClosureModel): ScalarChannels {
  const { radius, backgroundIntensityPerSteradian: intensity, sourceToMatchedRatio } = model;
  if (!(sourceToMatchedRatio >= 0)) throw new Error("sourceToMatchedRatio must be non-negative");
  const matchedDensity = matchedUniformSourceDensity(radius, intensity);
  const sphere: SphereModel = {
    radius,
    density: matchedDensity * sourceToMatchedRatio,
  };
  const bodyW0 = bodyW0UniformSphere(distance, sphere);
  const bodyW1Magnitude = bodyW1UniformSphere(distance, sphere);
  const background = backgroundExteriorChannels(distance, radius, intensity);
  return {
    radiusRatio: distance / radius,
    bodyW0,
    bodyW1Magnitude,
    backgroundIncident: background?.incident ?? null,
    backgroundStraightSurviving: background?.surviving ?? null,
    backgroundStraightDeficit: background?.deficit ?? null,
    backgroundResidualMagnitude: background?.residualMagnitude ?? null,
    // Positive sign = direct body-associated outgoing branch, radially away.
    directBodyOutgoingSigned: bodyW1Magnitude,
    // Negative sign = external background residual, radially toward the body.
    externalBackgroundResidualSigned: background ? -background.residualMagnitude : null,
    netDirectionalSigned: background ? bodyW1Magnitude - background.residualMagnitude : null,
  };
}

export function normalizedOneBodyClosureSample(distance: number, model: ClosureModel): ScalarChannels {
  const raw = oneBodyClosureSample(distance, model);
  const scale = matchedOutgoingCoefficient(model.radius, model.backgroundIntensityPerSteradian) / model.radius ** 2;
  const normalize = (value: number | null): number | null => value === null ? null : value / scale;
  return {
    radiusRatio: raw.radiusRatio,
    bodyW0: raw.bodyW0 / scale,
    bodyW1Magnitude: raw.bodyW1Magnitude / scale,
    backgroundIncident: normalize(raw.backgroundIncident),
    backgroundStraightSurviving: normalize(raw.backgroundStraightSurviving),
    backgroundStraightDeficit: normalize(raw.backgroundStraightDeficit),
    backgroundResidualMagnitude: normalize(raw.backgroundResidualMagnitude),
    directBodyOutgoingSigned: raw.directBodyOutgoingSigned / scale,
    externalBackgroundResidualSigned: normalize(raw.externalBackgroundResidualSigned),
    netDirectionalSigned: normalize(raw.netDirectionalSigned),
  };
}
