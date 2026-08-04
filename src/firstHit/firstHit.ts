import type { FirstHitResult, RigidGroup, Vec3 } from "../app/contracts";

export function fibonacciDirections(count: number): Vec3[] {
  const result: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - 2 * (i + 0.5) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * golden;
    result.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
  }
  return result;
}

export function raySphereDistance(origin: Vec3, direction: Vec3, centre: Vec3, radius: number): number | null {
  const oc: Vec3 = [origin[0] - centre[0], origin[1] - centre[1], origin[2] - centre[2]];
  const b = oc[0] * direction[0] + oc[1] * direction[1] + oc[2] * direction[2];
  const c = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - radius ** 2;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const near = -b - root; const far = -b + root;
  return near > 1e-9 ? near : far > 1e-9 ? far : null;
}

export function computeFirstHit(origin: Vec3, bodies: RigidGroup[], directionCount: number, maxDistance: number): FirstHitResult {
  const directions = fibonacciDirections(directionCount);
  const distances: number[] = [];
  const bodyIds: (string | null)[] = [];
  for (const direction of directions) {
    let best = maxDistance; let id: string | null = null;
    for (const body of bodies) {
      if (!body.visible) continue;
      const hit = raySphereDistance(origin, direction, body.transform.position, body.outer_radius);
      if (hit !== null && hit <= best) { best = hit; id = body.object_id; }
    }
    distances.push(id ? best : Number.POSITIVE_INFINITY); bodyIds.push(id);
  }
  const hits = bodyIds.filter(Boolean).length;
  const firstOpen = bodyIds.findIndex((id) => id === null);
  const openFraction = 1 - hits / directionCount;
  const finite = distances.filter(Number.isFinite);
  const openDirections = directions.filter((_, index) => bodyIds[index] === null);
  const hitDirections = directions.filter((_, index) => bodyIds[index] !== null);
  let largestHole = 0;
  if (openDirections.length && !hitDirections.length) largestHole = Math.PI;
  else if (openDirections.length) {
    const sampledOpen = openDirections.filter((_, i) => i % Math.max(1, Math.ceil(openDirections.length / 1024)) === 0);
    const sampledHit = hitDirections.filter((_, i) => i % Math.max(1, Math.ceil(hitDirections.length / 512)) === 0);
    for (const open of sampledOpen) {
      let nearest = Math.PI;
      for (const hit of sampledHit) nearest = Math.min(nearest, Math.acos(Math.max(-1, Math.min(1, open[0] * hit[0] + open[1] * hit[1] + open[2] * hit[2]))));
      largestHole = Math.max(largestHole, nearest);
    }
  }
  return {
    direction_count: directionCount,
    coverage_fraction: hits / directionCount,
    uncovered_solid_angle: 4 * Math.PI * openFraction,
    largest_angular_hole: largestHole,
    largest_hole_direction: firstOpen >= 0 ? directions[firstOpen]! : [0, 0, 0],
    maximum_first_hit_distance: finite.length ? Math.max(...finite) : null,
    distances, body_ids: bodyIds, directions,
  };
}
