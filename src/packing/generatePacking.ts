import type { PackingDefinition, PackingLevel, PackingMode, Vec3, VoxelElement } from "../app/contracts";

export const PACKING_TARGETS: Record<PackingLevel, number> = { P0: 20, P1: 96, P2: 512, P3: 1536, P4: 2048 };

function candidates(mode: PackingMode, span: number): Vec3[] {
  const points: Vec3[] = [];
  const add = (x: number, y: number, z: number) => {
    if (x * x + y * y + z * z <= 1 + 1e-12) points.push([x, y, z]);
  };
  const h = mode === "HCP" ? Math.sqrt(2 / 3) : 1;
  for (let k = -span; k <= span; k += 1) for (let j = -span; j <= span; j += 1) for (let i = -span; i <= span; i += 1) {
    if (mode === "HCP") {
      const x = (i + 0.5 * (j & 1) + 0.5 * (k & 1)) / span;
      const y = (j * Math.sqrt(3) / 2) / span;
      add(x, y, k * h / span);
      continue;
    }
    add(i / span, j / span, k / span);
    if (mode === "BCC") add((i + 0.5) / span, (j + 0.5) / span, (k + 0.5) / span);
    if (mode === "FCC") {
      add((i + 0.5) / span, (j + 0.5) / span, k / span);
      add((i + 0.5) / span, j / span, (k + 0.5) / span);
      add(i / span, (j + 0.5) / span, (k + 0.5) / span);
    }
  }
  return points;
}

export function generatePacking(
  mode: PackingMode,
  level: PackingLevel,
  radius: number,
  totalAmount: number,
  customCount: number | null = null,
  imported: Vec3[] = [],
): { definition: PackingDefinition; elements: VoxelElement[] } {
  const target = Math.max(1, level === "P4" && customCount ? customCount : PACKING_TARGETS[level]);
  let raw = mode === "IMPORTED_POINTS" ? imported.map((p) => [...p] as Vec3) : candidates(mode, Math.max(2, Math.ceil(Math.cbrt(target) * 0.82)));
  if (raw.length < target && mode !== "IMPORTED_POINTS") raw = candidates(mode, Math.ceil(Math.cbrt(target) * 1.2));
  if (!raw.length) raw = [[0, 0, 0]];
  raw.sort((a, b) => (a[0] ** 2 + a[1] ** 2 + a[2] ** 2) - (b[0] ** 2 + b[1] ** 2 + b[2] ** 2));
  raw = raw.slice(0, Math.min(target, raw.length));
  const centre: Vec3 = raw.reduce<Vec3>((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / raw.length) as Vec3;
  const points = raw.map<Vec3>((p) => [(p[0] - centre[0]) * radius * 0.92, (p[1] - centre[1]) * radius * 0.92, (p[2] - centre[2]) * radius * 0.92]);
  const amount = totalAmount / points.length;
  const elements = points.map((local_position) => ({ local_position, amount, volume: amount }));
  const residual = totalAmount - elements.reduce((sum, e) => sum + e.amount, 0);
  elements[elements.length - 1]!.amount += residual;
  return {
    definition: {
      mode, level, custom_count: level === "P4" ? target : null,
      display_count: elements.length, compute_count: elements.length,
      boundary_policy: mode === "IMPORTED_POINTS" ? "IMPORTED_POINTS" : "SPHERE_CLIP_RECENTER_RENORMALIZE",
    },
    elements,
  };
}

