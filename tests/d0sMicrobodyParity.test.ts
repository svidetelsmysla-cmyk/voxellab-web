import { describe, expect, it } from "vitest";
import {
  D0S_LEVELS,
  evaluateD0SMicrobodies,
  generateD0SMicrobodies,
  runD0SLevel,
  runD0SParity,
} from "../src/actionLab/d0sMicrobodyParity";
import { sphereVolume, vectorNorm, type Vec3 } from "../src/actionLab/math";

const model = { radius: 1, density: 1 };

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

describe("D0S static equal-microbody representation parity", () => {
  it("builds the frozen positive equal-weight refinement family", () => {
    for (const definition of D0S_LEVELS) {
      const { bodies, shellCounts } = generateD0SMicrobodies(model, definition);
      expect(bodies).toHaveLength(definition.count);
      expect(shellCounts).toHaveLength(definition.shellCount);
      expect(shellCounts.reduce((sum, value) => sum + value, 0)).toBe(definition.count);
      expect(shellCounts.every((value) => value >= 2 && value % 2 === 0)).toBe(true);
      expect(bodies.every((body) => body.amount > 0)).toBe(true);

      const amount = bodies[0]!.amount;
      expect(bodies.every((body) => body.amount === amount)).toBe(true);
      expect(bodies.reduce((sum, body) => sum + body.amount, 0)).toBeCloseTo(sphereVolume(model), 12);

      const centre = bodies.reduce<Vec3>(
        (sum, body) => add(sum, [
          body.position[0] * body.amount,
          body.position[1] * body.amount,
          body.position[2] * body.amount,
        ]),
        [0, 0, 0],
      );
      expect(vectorNorm(centre) / sphereVolume(model)).toBeLessThan(1e-14);
    }
  });

  it("keeps every shell antipodally paired before any dynamics", () => {
    const { bodies } = generateD0SMicrobodies(model, D0S_LEVELS[2]!);
    for (let index = 0; index < bodies.length; index += 2) {
      const left = bodies[index]!;
      const right = bodies[index + 1]!;
      expect(left.shellIndex).toBe(right.shellIndex);
      expect(vectorNorm(add(left.position, right.position))).toBeLessThan(1e-13);
    }
  });

  it("is invariant to particle ordering and simultaneous global rotation", () => {
    const finest = runD0SLevel(model, D0S_LEVELS.at(-1)!);
    expect(finest.permutationW0Delta).toBeLessThanOrEqual(1e-13);
    expect(finest.permutationW1Delta).toBeLessThanOrEqual(1e-13);
    expect(finest.rotationW0Delta).toBeLessThanOrEqual(1e-12);
    expect(finest.rotationW1Delta).toBeLessThanOrEqual(1e-12);
  });

  it("converges from N48 to N3072 without fitting probes or tolerances", () => {
    const result = runD0SParity(model);
    const coarsest = result.levels[0]!;
    const finest = result.levels.at(-1)!;
    expect(coarsest.probeRows).toHaveLength(42);
    expect(finest.probeRows).toHaveLength(42);
    expect(finest.maximumW1VectorRelativeError).toBeLessThan(coarsest.maximumW1VectorRelativeError / 20);
    expect(Math.max(finest.maximumW0OrientationSpread, finest.maximumW1OrientationSpread))
      .toBeLessThan(Math.max(coarsest.maximumW0OrientationSpread, coarsest.maximumW1OrientationSpread) / 20);
    expect(finest.multipoles.l2).toBeLessThan(coarsest.multipoles.l2);
    expect(finest.multipoles.l4).toBeLessThan(coarsest.multipoles.l4);
  });

  it("passes the preregistered finest-level D0S corridor and only then opens D0M", () => {
    const result = runD0SParity(model);
    expect(result.gates).toHaveLength(17);
    expect(result.gates.every((gate) => gate.pass)).toBe(true);
    expect(result.verdict).toBe("D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS");
    expect(result.d0mStatus).toBe("OPEN_AFTER_D0S_PASS");
    expect(result.claimCeiling).toBe("STATIC_EQUAL_MICROBODY_REPRESENTATION_METHOD_PARITY_ONLY");
  });

  it("evaluates only the direct static body-associated route", () => {
    const { bodies } = generateD0SMicrobodies(model, D0S_LEVELS[1]!);
    const sample = evaluateD0SMicrobodies([2, 0, 0], bodies);
    expect(sample.w0).toBeGreaterThan(0);
    expect(sample.w1Magnitude).toBeGreaterThan(0);
    expect(sample.w1[0]).toBeLessThan(0);
  });
});
