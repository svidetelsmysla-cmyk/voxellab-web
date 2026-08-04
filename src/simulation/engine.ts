import type { ComputeResult, Quat, RigidGroup, SceneDocumentV2, Vec3 } from "../app/contracts";

const mag = (v: Vec3) => Math.hypot(...v);

function rotate([x, y, z, w]: Quat, [vx, vy, vz]: Vec3): Vec3 {
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx];
}

function worldElements(body: RigidGroup): { position: Vec3; offset: Vec3; amount: number }[] {
  const elements = body.voxel_elements.length ? body.voxel_elements : [{ local_position: [0, 0, 0] as Vec3, amount: body.amount, volume: 1 }];
  return elements.map((element) => {
    const scaled: Vec3 = element.local_position.map((value, axis) => value * body.transform.scale[axis]!) as Vec3;
    const offset = rotate(body.transform.rotation, scaled);
    return { position: body.transform.position.map((value, axis) => value + offset[axis]!) as Vec3, offset, amount: element.amount };
  });
}

function computeDistributedElements(scene: SceneDocumentV2, started: number, now: () => number): ComputeResult {
  const forces = scene.objects.map<Vec3>(() => [0, 0, 0]), torques = scene.objects.map<Vec3>(() => [0, 0, 0]);
  const elements = scene.objects.map(worldElements);
  for (let i = 0; i < scene.objects.length; i += 1) for (let j = i + 1; j < scene.objects.length; j += 1) {
    const a = scene.objects[i]!, b = scene.objects[j]!;
    for (const ea of elements[i]!) for (const eb of elements[j]!) {
      const d: Vec3 = ea.position.map((value, axis) => value - eb.position[axis]!) as Vec3;
      const r2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      if (r2 <= 1e-18) continue;
      const factor = scene.coefficient_c * Math.sqrt(a.k_v * b.k_v) * ea.amount * eb.amount / (r2 * Math.sqrt(r2));
      const f: Vec3 = d.map((value) => factor * value) as Vec3;
      forces[i] = forces[i]!.map((value, axis) => value + f[axis]!) as Vec3;
      forces[j] = forces[j]!.map((value, axis) => value - f[axis]!) as Vec3;
      torques[i] = [torques[i]![0] + ea.offset[1] * f[2] - ea.offset[2] * f[1], torques[i]![1] + ea.offset[2] * f[0] - ea.offset[0] * f[2], torques[i]![2] + ea.offset[0] * f[1] - ea.offset[1] * f[0]];
      torques[j] = [torques[j]![0] - (eb.offset[1] * f[2] - eb.offset[2] * f[1]), torques[j]![1] - (eb.offset[2] * f[0] - eb.offset[0] * f[2]), torques[j]![2] - (eb.offset[0] * f[1] - eb.offset[1] * f[0])];
    }
  }
  const amount = scene.objects.reduce((sum, body) => sum + body.amount, 0), net = forces.reduce<Vec3>((sum, force) => sum.map((value, axis) => value + force[axis]!) as Vec3, [0, 0, 0]);
  return { backend: "CPU_DIRECT", evaluation_method: "DISTRIBUTED_ELEMENTS", bodies: scene.objects.map((body, i) => ({ object_id: body.object_id, force: forces[i]!, torque: torques[i]! })), amount_in: amount, amount_out: amount, amount_residual: 0, action_reaction_residual: mag(net), compute_ms: Math.max(0, now() - started) };
}

export function computeBodyPairs(scene: SceneDocumentV2, now = () => performance.now()): ComputeResult {
  const started = now();
  if (scene.simulation.evaluation_method === "DISTRIBUTED_ELEMENTS") return computeDistributedElements(scene, started, now);
  const forces = scene.objects.map<Vec3>(() => [0, 0, 0]);
  for (let i = 0; i < scene.objects.length; i += 1) for (let j = i + 1; j < scene.objects.length; j += 1) {
    const a = scene.objects[i]!; const b = scene.objects[j]!;
    const d: Vec3 = [a.transform.position[0] - b.transform.position[0], a.transform.position[1] - b.transform.position[1], a.transform.position[2] - b.transform.position[2]];
    const r2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    if (r2 <= (a.outer_radius + b.outer_radius) ** 2 * 0.01) continue;
    const factor = scene.coefficient_c * Math.sqrt(a.k_v * b.k_v) * a.amount * b.amount / (r2 * Math.sqrt(r2));
    const f: Vec3 = [factor * d[0], factor * d[1], factor * d[2]];
    forces[i] = [forces[i]![0] + f[0], forces[i]![1] + f[1], forces[i]![2] + f[2]];
    forces[j] = [forces[j]![0] - f[0], forces[j]![1] - f[1], forces[j]![2] - f[2]];
  }
  const amount = scene.objects.reduce((sum, b) => sum + b.amount, 0);
  const net = forces.reduce<Vec3>((s, f) => [s[0] + f[0], s[1] + f[1], s[2] + f[2]], [0, 0, 0]);
  return {
    backend: "CPU_DIRECT", evaluation_method: scene.simulation.evaluation_method,
    bodies: scene.objects.map((b, i) => ({ object_id: b.object_id, force: forces[i]!, torque: [0, 0, 0] })),
    amount_in: amount, amount_out: amount, amount_residual: 0, action_reaction_residual: mag(net), compute_ms: Math.max(0, now() - started),
  };
}

function integrateQuaternion(q: Quat, omega: Vec3, dt: number): Quat {
  const [x, y, z, w] = q; const [ox, oy, oz] = omega;
  const n: Quat = [x + 0.5 * (ox * w + oy * z - oz * y) * dt, y + 0.5 * (-ox * z + oy * w + oz * x) * dt, z + 0.5 * (ox * y - oy * x + oz * w) * dt, w + 0.5 * (-ox * x - oy * y - oz * z) * dt];
  const length = Math.hypot(...n) || 1;
  return n.map((v) => v / length) as Quat;
}

export function symplecticStep(scene: SceneDocumentV2): ComputeResult {
  const result = computeBodyPairs(scene); const dt = scene.simulation.dt;
  for (const item of result.bodies) {
    const body = scene.objects.find((b) => b.object_id === item.object_id)!;
    if (!body.world_locked && body.movable_translation) {
      body.velocity = body.velocity.map((v, axis) => v + item.force[axis]! / body.amount * dt) as Vec3;
      if (scene.simulation.damping_enabled) body.velocity = body.velocity.map((v) => v * scene.simulation.damping_factor) as Vec3;
      body.transform.position = body.transform.position.map((v, axis) => v + body.velocity[axis]! * dt) as Vec3;
    }
    if (!body.world_locked && body.movable_rotation) body.transform.rotation = integrateQuaternion(body.transform.rotation, body.angular_velocity, dt);
  }
  return result;
}

export function resetMotion(body: RigidGroup): void {
  body.velocity = [...body.initial_velocity]; body.angular_velocity = [...body.initial_angular_velocity];
}
