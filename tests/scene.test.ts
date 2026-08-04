import { describe, expect, it } from "vitest";

import { computeDirect, flattenScene } from "../src/kernel";
import { builtInScenes, loadBuiltInScene } from "../src/scenes";
import { parsePacket, parseScene, rotateVector, ValidationError } from "../src/schema";

describe("versioned scene schema", () => {
  it("accepts all five built-in scenes", () => {
    expect(Object.keys(builtInScenes)).toHaveLength(5);
    for (const scene of Object.values(builtInScenes)) expect(parseScene(scene).scene_version).toBe("1.0");
  });

  it("reports exact invalid amount-ledger paths", () => {
    const scene = loadBuiltInScene("SCENE_03_MOVABLE_RIGID_VOLUME");
    scene.objects[0]!.voxel_elements[0]!.amount += 0.25;
    expect(() => parseScene(scene)).toThrowError(ValidationError);
    try {
      parseScene(scene);
    } catch (error) {
      expect((error as ValidationError).issues.join(" ")).toContain("objects[0].amount");
    }
  });
});

describe("rigid-volume and CM separation", () => {
  it("keeps local coordinates rigid under quaternion transform", () => {
    const rotated = rotateVector([1, 0, 0], [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    expect(rotated[0]).toBeCloseTo(0, 12);
    expect(rotated[1]).toBeCloseTo(1, 12);
    expect(rotated[2]).toBeCloseTo(0, 12);
  });

  it("uses many positive elements for volume and one point for CM control", () => {
    const scene = loadBuiltInScene("SCENE_03_MOVABLE_RIGID_VOLUME");
    const rigid = flattenScene(scene);
    const cm = flattenScene(scene, new Map(scene.objects.map((body) => [body.object_id, "CM_CONTROL" as const])));
    expect(rigid.length).toBe(54);
    expect(cm.length).toBe(2);
    expect(rigid.every((item) => item.amount > 0)).toBe(true);
    expect(cm.every((item) => item.amount > 0)).toBe(true);
  });
});

describe("direct positive-action CPU kernel", () => {
  it("matches the exact two-CM unit and closes amount/action ledgers", () => {
    const result = computeDirect(loadBuiltInScene("SCENE_01_CM_CONTROL"), new Map(), () => 0);
    expect(result.amount_in).toBe(3);
    expect(result.amount_out).toBe(3);
    expect(result.amount_residual).toBe(0);
    const expected = 2 / 2.2 ** 2;
    expect(result.bodies[0]!.force[0]).toBeCloseTo(-expected, 14);
    expect(result.bodies[1]!.force[0]).toBeCloseTo(expected, 14);
    expect(result.bodies[0]!.force.slice(1)).toEqual([0, 0]);
    expect(result.bodies[1]!.force.slice(1)).toEqual([0, 0]);
    expect(result.bodies[0]!.torque).toEqual([0, 0, 0]);
  });

  it("excludes all same-body pairs", () => {
    const scene = loadBuiltInScene("SCENE_03_MOVABLE_RIGID_VOLUME");
    scene.objects = [scene.objects[0]!];
    const result = computeDirect(scene);
    expect(result.bodies[0]!.force).toEqual([0, 0, 0]);
    expect(result.bodies[0]!.torque).toEqual([0, 0, 0]);
  });

  it("stops on cross-body coincident elements without softening", () => {
    const scene = loadBuiltInScene("SCENE_01_CM_CONTROL");
    scene.objects[1]!.transform.position = [...scene.objects[0]!.transform.position];
    expect(() => computeDirect(scene)).toThrow(/OVERLAP/);
  });
});

describe("browser packet parser", () => {
  it("accepts the governed read-only packet envelope", () => {
    const packet = parsePacket({
      packet_version: "1.0",
      producer_commit: "a".repeat(40),
      packet_sha256: "b".repeat(64),
      manifest_sha256: "c".repeat(64),
      verdict: "RIGID_VOLUME_AND_SOLID_ANGLE_SH_PARITY_BLOCKER",
      claim_ceiling: "RUNTIME_DIAGNOSTIC_NOT_VALIDATION",
      scene: {},
      body_transforms: [],
      body_forces: [],
      body_torques: [],
      amount_ledger: [8, 0],
      diagnostics: {},
      visual_arrays: {},
    });
    expect(packet.claim_ceiling).toBe("RUNTIME_DIAGNOSTIC_NOT_VALIDATION");
  });
});
