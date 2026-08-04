import type { RigidGroup, Vec3 } from "../app/contracts";

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function motionLedgers(bodies: RigidGroup[]) {
  const amount = bodies.reduce((sum, b) => sum + b.amount, 0);
  const momentum = bodies.reduce<Vec3>((s, b) => add(s, b.velocity.map((v) => v * b.amount) as Vec3), [0, 0, 0]);
  const centre = bodies.reduce<Vec3>((s, b) => add(s, b.transform.position.map((v) => v * b.amount / amount) as Vec3), [0, 0, 0]);
  const angular = bodies.reduce<Vec3>((s, b) => add(s, cross(b.transform.position, b.velocity.map((v) => v * b.amount) as Vec3)), [0, 0, 0]);
  return { amount, momentum, centre_of_amount: centre, angular_momentum: angular };
}

