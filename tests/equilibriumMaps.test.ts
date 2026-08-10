import { describe, expect, it } from "vitest";
import { classifySymmetricJacobian2D } from "../src/actionLab/EquilibriumMapPanel";

describe("A5 equilibrium classification ceiling", () => {
  it("separates wells, crests, saddles and neutral directions by the symmetric Jacobian", () => {
    expect(classifySymmetricJacobian2D(-2, 0, 0, -1)).toBe("converging");
    expect(classifySymmetricJacobian2D(2, 0, 0, 1)).toBe("diverging");
    expect(classifySymmetricJacobian2D(-2, 0, 0, 1)).toBe("saddle");
    expect(classifySymmetricJacobian2D(0, 0, 0, -1)).toBe("neutral");
  });
});
