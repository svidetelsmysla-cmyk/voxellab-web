import { gaussLegendre } from "./math";
import { equalSphereOverlapVolume } from "./overlapGeometry";

export type FreeBoundaryBranchStatus =
  | "NO_REFERENCE_CONFLICT"
  | "DISTINCT_CLUMPS_FREE_BOUNDARY_REQUIRED"
  | "DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER";

export interface FreeBoundaryModel {
  radius: number;
  separation: number;
}

export interface FreeBoundaryBounds {
  radius: number;
  separation: number;
  separationRatio: number;
  sphereVolume: number;
  overlapDepth: number;
  overlapVolume: number;
  overlapFraction: number;
  displacedVolumePerClump: number;
  displacedFractionPerClump: number;
  requiredOutsideReferenceUnion: number;
  referenceUnionVolume: number;
  amountClosureResidual: number;
  minimumOuterRadius: number;
  minimumOuterRadiusRatio: number;
  minimumShellThickness: number;
  minimumShellThicknessRatio: number;
  distinctCentreDistance: number;
  branchStatus: FreeBoundaryBranchStatus;
  constitutiveLawRequired: boolean;
}

export interface FreeBoundaryParity {
  analyticOverlapVolume: number;
  numericOverlapVolume: number;
  overlapVolumeRelativeError: number;
  analyticFirstMomentX: number;
  numericFirstMomentX: number;
  firstMomentRelativeError: number;
  splitLedgerResidual: number;
  amountClosureResidual: number;
}

const EPS = 1e-12;

function requireModel(model: FreeBoundaryModel): void {
  if (!(model.radius > 0)) throw new Error("A2B radius must be positive");
  if (!(model.separation >= 0)) throw new Error("A2B separation must be non-negative");
}

export function sphereVolume(radius: number): number {
  if (!(radius > 0)) throw new Error("Sphere radius must be positive");
  return 4 * Math.PI * radius ** 3 / 3;
}

export function overlapFractionFromSeparationRatio(separationRatio: number): number {
  if (!(separationRatio >= 0)) throw new Error("separationRatio must be non-negative");
  if (separationRatio >= 2) return 0;
  return (4 + separationRatio) * (2 - separationRatio) ** 2 / 16;
}

export function minimumShellThicknessRatioFromOverlapFraction(overlapFraction: number): number {
  if (!(overlapFraction >= 0 && overlapFraction <= 1 + EPS)) {
    throw new Error("overlapFraction must be in [0,1]");
  }
  return Math.cbrt(1 + 0.5 * Math.min(1, overlapFraction)) - 1;
}

export function freeBoundaryBounds(model: FreeBoundaryModel): FreeBoundaryBounds {
  requireModel(model);
  const R = model.radius;
  const d = model.separation;
  const V = sphereVolume(R);
  const overlapVolume = equalSphereOverlapVolume(R, d);
  const overlapFraction = overlapVolume / V;
  const displacedVolumePerClump = overlapVolume / 2;
  const minimumOuterRadiusRatio = Math.cbrt(1 + overlapFraction / 2);
  const minimumOuterRadius = R * minimumOuterRadiusRatio;
  const referenceUnionVolume = 2 * V - overlapVolume;
  const requiredOutsideReferenceUnion = overlapVolume;
  const branchStatus: FreeBoundaryBranchStatus = d <= EPS
    ? "DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER"
    : d >= 2 * R - EPS
      ? "NO_REFERENCE_CONFLICT"
      : "DISTINCT_CLUMPS_FREE_BOUNDARY_REQUIRED";
  return {
    radius: R,
    separation: d,
    separationRatio: d / R,
    sphereVolume: V,
    overlapDepth: Math.max(0, 2 * R - d),
    overlapVolume,
    overlapFraction,
    displacedVolumePerClump,
    displacedFractionPerClump: overlapFraction / 2,
    requiredOutsideReferenceUnion,
    referenceUnionVolume,
    amountClosureResidual: referenceUnionVolume + requiredOutsideReferenceUnion - 2 * V,
    minimumOuterRadius,
    minimumOuterRadiusRatio,
    minimumShellThickness: minimumOuterRadius - R,
    minimumShellThicknessRatio: minimumOuterRadiusRatio - 1,
    distinctCentreDistance: d,
    branchStatus,
    constitutiveLawRequired: d > EPS && d < 2 * R - EPS,
  };
}

function integrateGauss(
  start: number,
  end: number,
  order: number,
  integrand: (x: number) => number,
): number {
  if (!(end > start)) return 0;
  const rule = gaussLegendre(order);
  const half = (end - start) / 2;
  const middle = (start + end) / 2;
  let total = 0;
  for (let index = 0; index < order; index += 1) {
    const node = rule.nodes[index];
    const weight = rule.weights[index];
    if (node === undefined || weight === undefined) throw new Error("Incomplete Gauss rule");
    total += half * weight * integrand(middle + half * node);
  }
  return total;
}

function overlapCrossSectionArea(x: number, radius: number, separation: number): number {
  const first = radius ** 2 - x ** 2;
  const second = radius ** 2 - (x - separation) ** 2;
  return Math.PI * Math.max(0, Math.min(first, second));
}

export function numericReferenceOverlap(
  model: FreeBoundaryModel,
  order = 96,
): { volume: number; firstMomentX: number } {
  requireModel(model);
  const R = model.radius;
  const d = model.separation;
  if (d >= 2 * R) return { volume: 0, firstMomentX: 0 };
  const start = d - R;
  const end = R;
  const midpoint = d / 2;
  const area = (x: number) => overlapCrossSectionArea(x, R, d);
  const integratePiecewise = (integrand: (x: number) => number) => {
    if (Math.abs(d) <= EPS) return integrateGauss(start, end, order, integrand);
    return integrateGauss(start, midpoint, order, integrand)
      + integrateGauss(midpoint, end, order, integrand);
  };
  return {
    volume: integratePiecewise(area),
    firstMomentX: integratePiecewise(x => x * area(x)),
  };
}

function relativeError(value: number, reference: number): number {
  if (Math.abs(reference) <= 1e-15) return Math.abs(value - reference);
  return Math.abs(value - reference) / Math.abs(reference);
}

export function freeBoundaryParity(model: FreeBoundaryModel): FreeBoundaryParity {
  const bounds = freeBoundaryBounds(model);
  const numeric = numericReferenceOverlap(model);
  const analyticFirstMomentX = 0.5 * model.separation * bounds.overlapVolume;
  return {
    analyticOverlapVolume: bounds.overlapVolume,
    numericOverlapVolume: numeric.volume,
    overlapVolumeRelativeError: relativeError(numeric.volume, bounds.overlapVolume),
    analyticFirstMomentX,
    numericFirstMomentX: numeric.firstMomentX,
    firstMomentRelativeError: relativeError(numeric.firstMomentX, analyticFirstMomentX),
    splitLedgerResidual: 2 * bounds.displacedVolumePerClump - bounds.overlapVolume,
    amountClosureResidual: bounds.amountClosureResidual,
  };
}

export interface FreeBoundaryReferenceRow {
  label: string;
  separationRatio: number;
  overlapFraction: number;
  displacedFractionPerClump: number;
  minimumShellThicknessRatio: number;
  branchStatus: FreeBoundaryBranchStatus;
}

export function referenceRows(): FreeBoundaryReferenceRow[] {
  const ratios = [2, 1.2, 1, Math.sqrt(3) - 1, 0];
  return ratios.map(separationRatio => {
    const bounds = freeBoundaryBounds({ radius: 1, separation: separationRatio });
    const label = separationRatio === 2 ? "CONTACT"
      : separationRatio === 1.2 ? "A2 DEFAULT"
        : separationRatio === 1 ? "HALF-CENTRE SEPARATION"
          : separationRatio === 0 ? "CONCENTRIC"
            : "A2 DUAL-CONTROL PEAK";
    return {
      label,
      separationRatio,
      overlapFraction: bounds.overlapFraction,
      displacedFractionPerClump: bounds.displacedFractionPerClump,
      minimumShellThicknessRatio: bounds.minimumShellThicknessRatio,
      branchStatus: bounds.branchStatus,
    };
  });
}
