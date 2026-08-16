import type { FirstHitResult, KouDefinition, RigidGroup, Vec3 } from "../app/contracts";
import { computeFirstHit } from "../firstHit/firstHit";
import { generateKou } from "../kou/generateKou";

export type ChrysanthemumGeometryMode = "ORDERED_ANTIPODAL" | "RANDOM_ANTIPODAL";

export interface ChrysanthemumMetrics {
  coverage: number;
  meanDepth: number;
  coefficientOfVariation: number;
  robustLobeAmplitude: number;
  minimumDepth: number;
  maximumDepth: number;
  tierFractions: number[];
}

function xorshift32(seed: number) {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function randomUnit(next: () => number): Vec3 {
  const z = 1 - 2 * next();
  const phi = 2 * Math.PI * next();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

function norm(v: Vec3) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function chrysanthemumKou(
  tiers: number,
  bodyRadius: number,
  geometryMode: ChrysanthemumGeometryMode,
  randomSeed = 1701,
): RigidGroup[] {
  const definition: KouDefinition = {
    enabled: true,
    preset: "M0_K4",
    m: 3,
    tiers,
    tier_spacing: 1.05,
    body_amount: 0.03,
    body_radius: bodyRadius,
    near_movable_tiers: 1,
    guard_tiers: 1,
    far_fixed_tiers: 1,
    orientation_seed: 17,
    all_movable: false,
    hidden_tiers: [],
  };
  const bodies = generateKou(definition).map((body) => ({
    ...body,
    outer_radius: bodyRadius,
    world_locked: true,
    movable_translation: false,
    movable_rotation: false,
    visible: true,
  }));

  if (geometryMode === "ORDERED_ANTIPODAL") return bodies;

  const next = xorshift32(randomSeed);
  for (let i = 0; i + 1 < bodies.length; i += 2) {
    const a = bodies[i]!;
    const b = bodies[i + 1]!;
    const radius = norm(a.transform.position);
    const direction = randomUnit(next);
    a.transform = { ...a.transform, position: [radius * direction[0], radius * direction[1], radius * direction[2]] };
    b.transform = { ...b.transform, position: [-radius * direction[0], -radius * direction[1], -radius * direction[2]] };
  }
  return bodies;
}

function quantile(values: number[], p: number) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const x = Math.max(0, Math.min(sorted.length - 1, p * (sorted.length - 1)));
  const lo = Math.floor(x), hi = Math.ceil(x), f = x - lo;
  return sorted[lo]! * (1 - f) + sorted[hi]! * f;
}

export function chrysanthemumMetrics(result: FirstHitResult, bodies: readonly RigidGroup[]): ChrysanthemumMetrics {
  const finite = result.distances.filter(Number.isFinite);
  const coverage = result.coverage_fraction;
  if (!finite.length) {
    return {
      coverage,
      meanDepth: Number.NaN,
      coefficientOfVariation: Number.NaN,
      robustLobeAmplitude: Number.NaN,
      minimumDepth: Number.NaN,
      maximumDepth: Number.NaN,
      tierFractions: [],
    };
  }
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
  const variance = finite.reduce((a, value) => a + (value - mean) ** 2, 0) / finite.length;
  const q05 = quantile(finite, 0.05), q95 = quantile(finite, 0.95);
  const tierById = new Map(bodies.map((body) => [body.object_id, body.kou_tier ?? 0]));
  const tierCounts: number[] = [];
  let hitCount = 0;
  for (const id of result.body_ids) {
    if (!id) continue;
    hitCount += 1;
    const tier = tierById.get(id) ?? 0;
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }
  return {
    coverage,
    meanDepth: mean,
    coefficientOfVariation: Math.sqrt(variance) / Math.max(mean, 1e-30),
    robustLobeAmplitude: (q95 - q05) / (2 * Math.max(mean, 1e-30)),
    minimumDepth: Math.min(...finite),
    maximumDepth: Math.max(...finite),
    tierFractions: tierCounts.map((count) => (count ?? 0) / Math.max(hitCount, 1)),
  };
}

export function computeChrysanthemum(
  tiers: number,
  bodyRadius: number,
  directionCount: number,
  geometryMode: ChrysanthemumGeometryMode = "ORDERED_ANTIPODAL",
  randomSeed = 1701,
) {
  const bodies = chrysanthemumKou(tiers, bodyRadius, geometryMode, randomSeed);
  const result = computeFirstHit([0, 0, 0], bodies, directionCount, 100);
  return { bodies, result, metrics: chrysanthemumMetrics(result, bodies) };
}

export function sharedFrontChange(current: FirstHitResult, previous: FirstHitResult) {
  if (current.distances.length !== previous.distances.length) return Number.NaN;
  let sum2 = 0, scale = 0, count = 0;
  for (let i = 0; i < current.distances.length; i += 1) {
    const a = current.distances[i]!, b = previous.distances[i]!;
    if (!(Number.isFinite(a) && Number.isFinite(b))) continue;
    const d = a - b;
    sum2 += d * d;
    scale += a;
    count += 1;
  }
  if (!count) return Number.NaN;
  return Math.sqrt(sum2 / count) / Math.max(scale / count, 1e-30);
}
