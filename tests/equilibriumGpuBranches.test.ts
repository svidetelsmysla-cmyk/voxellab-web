import { describe, expect, it } from "vitest";
import { minimumCostAssignment, trackRootBranches } from "../src/actionLab/equilibriumGpu/branchTracker";
import type { QualifiedRoot, Vec3 } from "../src/actionLab/equilibriumGpu/types";

function root(frameIndex: number, position: Vec3): QualifiedRoot {
  return {
    id: `r-${frameIndex}-${position[0]}`, frameIndex, position, response: [0, 0, 0], responseNorm: 0,
    jacobian: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]], stiffnessEigenvalues: [1, 1, 1],
    antisymmetryRatio: 0, regime: "RESTORING_ROOT", isRoot: true, residualRelative: 0,
  };
}

describe("density-independent root branch tracking", () => {
  it("uses global minimum cost instead of list order", () => {
    expect(minimumCostAssignment([[10, 0.1], [0.2, 10]])).toEqual([[0, 1], [1, 0]]);
  });

  it("tracks crossing root lists and applies two-frame persistence", () => {
    const frames = [
      [root(0, [-1, 0, 0]), root(0, [1, 0, 0])],
      [root(1, [0.8, 0, 0]), root(1, [-0.8, 0, 0]), root(1, [5, 0, 0])],
      [root(2, [-0.6, 0, 0]), root(2, [0.6, 0, 0])],
    ];
    const branches = trackRootBranches(frames, "FINITE_BOX");
    expect(branches.filter((branch) => branch.persistent)).toHaveLength(2);
    expect(branches.filter((branch) => !branch.persistent)).toHaveLength(1);
    expect(branches.every((branch) => branch.closure === "FINITE_BOX")).toBe(true);
  });
});
