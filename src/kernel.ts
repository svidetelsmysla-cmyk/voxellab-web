import { rotateVector } from "./schema";
import type { BodyResult, ComputeResult, RepresentationMode, SceneDocument, Vec3 } from "./types";

export interface FlatElement {
  bodyIndex: number;
  position: Vec3;
  localOffset: Vec3;
  amount: number;
  k_v: number;
}

export function flattenScene(scene: SceneDocument, overrides: Map<string, RepresentationMode> = new Map()): FlatElement[] {
  const result: FlatElement[] = [];
  scene.objects.forEach((body, bodyIndex) => {
    const mode = overrides.get(body.object_id) ?? body.representation_mode;
    const elements = mode === "CM_CONTROL"
      ? [{ local_position: [0, 0, 0] as Vec3, amount: body.amount, volume: body.amount / body.density }]
      : body.voxel_elements;
    for (const element of elements) {
      const rotated = rotateVector(element.local_position, body.transform.rotation);
      result.push({
        bodyIndex,
        position: [
          body.transform.position[0] + rotated[0],
          body.transform.position[1] + rotated[1],
          body.transform.position[2] + rotated[2],
        ],
        localOffset: rotated,
        amount: element.amount,
        k_v: body.k_v,
      });
    }
  });
  return result;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function computeDirect(
  scene: SceneDocument,
  overrides: Map<string, RepresentationMode> = new Map(),
  now: () => number = () => performance.now(),
): ComputeResult {
  const started = now();
  const elements = flattenScene(scene, overrides);
  const forces = scene.objects.map((): Vec3 => [0, 0, 0]);
  const torques = scene.objects.map((): Vec3 => [0, 0, 0]);
  const epsilon2 = 1e-12;
  for (const receiver of elements) {
    const receiverForce: Vec3 = [0, 0, 0];
    for (const source of elements) {
      if (source.bodyIndex === receiver.bodyIndex) continue;
      const dx = receiver.position[0] - source.position[0];
      const dy = receiver.position[1] - source.position[1];
      const dz = receiver.position[2] - source.position[2];
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 <= epsilon2) {
        throw new Error(`OVERLAP: bodies ${scene.objects[receiver.bodyIndex]?.object_id} and ${scene.objects[source.bodyIndex]?.object_id}`);
      }
      const factor = scene.coefficient_c * receiver.k_v * receiver.amount * source.amount / (r2 * Math.sqrt(r2));
      receiverForce[0] += factor * dx;
      receiverForce[1] += factor * dy;
      receiverForce[2] += factor * dz;
    }
    const bodyForce = forces[receiver.bodyIndex];
    const bodyTorque = torques[receiver.bodyIndex];
    if (!bodyForce || !bodyTorque) continue;
    bodyForce[0] += receiverForce[0];
    bodyForce[1] += receiverForce[1];
    bodyForce[2] += receiverForce[2];
    const torque = cross(receiver.localOffset, receiverForce);
    bodyTorque[0] += torque[0];
    bodyTorque[1] += torque[1];
    bodyTorque[2] += torque[2];
  }
  const amount = scene.objects.reduce((sum, body) => sum + body.amount, 0);
  const bodies: BodyResult[] = scene.objects.map((body, index) => ({
    object_id: body.object_id,
    force: forces[index] ?? [0, 0, 0],
    torque: torques[index] ?? [0, 0, 0],
  }));
  return {
    backend: "CPU_DIRECT",
    bodies,
    amount_in: amount,
    amount_out: amount,
    amount_residual: 0,
    compute_ms: Math.max(0, now() - started),
  };
}

export function vecMagnitude(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

export function relativeResultDelta(a: ComputeResult, b: ComputeResult): number {
  let numerator = 0;
  let denominator = 0;
  a.bodies.forEach((body, index) => {
    const other = b.bodies[index];
    if (!other) return;
    for (let axis = 0; axis < 3; axis += 1) {
      const av = body.force[axis] ?? 0;
      const bv = other.force[axis] ?? 0;
      numerator += (av - bv) ** 2;
      denominator += Math.max(av * av, bv * bv);
    }
  });
  return Math.sqrt(numerator / Math.max(denominator, 1e-30));
}
