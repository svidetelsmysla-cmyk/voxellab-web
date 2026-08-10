import type { ClosureMode, QualifiedRoot, RootBranch, Vec3 } from "./types";

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function rootMatchCost(a: QualifiedRoot, b: QualifiedRoot, distanceScale = 24, stiffnessScale = 1): number {
  const dx = distance(a.position, b.position) / distanceScale;
  const dk = distance(a.stiffnessEigenvalues, b.stiffnessEigenvalues) / Math.max(stiffnessScale, 1e-30);
  const typePenalty = a.regime === b.regime ? 0 : 0.75;
  return dx + 0.2 * dk + typePenalty;
}

/** Deterministic minimum-cost assignment. Rows may be left unmatched through dummy columns. */
export function minimumCostAssignment(cost: number[][], unmatchedCost = 1.5): Array<[number, number]> {
  const rows = cost.length;
  const realCols = cost[0]?.length ?? 0;
  if (!rows || !realCols) return [];
  const n = Math.max(rows, realCols);
  const matrix = Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) =>
    row < rows && col < realCols ? cost[row]![col]! : unmatchedCost));
  const u = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1), way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(n + 1).fill(Infinity);
    const used = new Uint8Array(n + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0]!;
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const current = matrix[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (current < minv[j]!) { minv[j] = current; way[j] = j0; }
        if (minv[j]! < delta) { delta = minv[j]!; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          const pj = p[j]!;
          u[pj] = u[pj]! + delta;
          v[j] = v[j]! - delta;
        } else minv[j] = minv[j]! - delta;
      }
      j0 = j1;
    } while (p[j0]! !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }
  const result: Array<[number, number]> = [];
  for (let col = 1; col <= n; col++) {
    const row = p[col]! - 1, realCol = col - 1;
    if (row >= 0 && row < rows && realCol < realCols && cost[row]![realCol]! < unmatchedCost) result.push([row, realCol]);
  }
  return result.sort((a, b) => a[0] - b[0]);
}

export function trackRootBranches(frames: QualifiedRoot[][], closure: ClosureMode): RootBranch[] {
  const branches: RootBranch[] = [];
  let active = new Map<number, number>();
  frames.forEach((roots, frameIndex) => {
    const previous = frameIndex ? frames[frameIndex - 1]! : [];
    const stiffnessScale = Math.max(1e-12, ...previous.flatMap((r) => r.stiffnessEigenvalues.map(Math.abs)));
    const assignments = minimumCostAssignment(previous.map((a) => roots.map((b) => rootMatchCost(a, b, 24, stiffnessScale))));
    const next = new Map<number, number>();
    const matched = new Set<number>();
    for (const [oldIndex, newIndex] of assignments) {
      const branchIndex = active.get(oldIndex);
      if (branchIndex === undefined) continue;
      const root = roots[newIndex]!;
      root.branchId = branches[branchIndex]!.id;
      branches[branchIndex]!.roots.push(root);
      next.set(newIndex, branchIndex);
      matched.add(newIndex);
    }
    roots.forEach((root, rootIndex) => {
      if (matched.has(rootIndex)) return;
      const branchIndex = branches.length;
      const id = `${closure === "FINITE_BOX" ? "F" : "P"}-B${String(branchIndex).padStart(3, "0")}`;
      root.branchId = id;
      branches.push({ id, closure, roots: [root], persistent: false });
      next.set(rootIndex, branchIndex);
    });
    active = next;
  });
  branches.forEach((branch) => { branch.persistent = branch.roots.length >= 2; });
  return branches;
}
