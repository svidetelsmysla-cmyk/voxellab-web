import type { BrowserPacket, SceneDocument, SceneObject, Vec3 } from "./types";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("\n"));
    this.name = "ValidationError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const vec = (value: unknown, size: number): value is number[] =>
  Array.isArray(value) && value.length === size && value.every(finiteNumber);

function validateObject(value: unknown, index: number, issues: string[]): value is SceneObject {
  const path = `objects[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${path}: expected object`);
    return false;
  }
  const requiredStrings = [
    "object_id",
    "group_id",
    "display_name",
    "body_role",
    "representation_mode",
    "geometry_type",
    "voxel_level",
  ];
  for (const key of requiredStrings) {
    if (typeof value[key] !== "string" || value[key] === "") issues.push(`${path}.${key}: non-empty string required`);
  }
  if (!isRecord(value.transform)) issues.push(`${path}.transform: object required`);
  else {
    if (!vec(value.transform.position, 3)) issues.push(`${path}.transform.position: finite vec3 required`);
    if (!vec(value.transform.rotation, 4)) issues.push(`${path}.transform.rotation: finite quaternion required`);
    if (!vec(value.transform.scale, 3)) issues.push(`${path}.transform.scale: finite vec3 required`);
  }
  for (const key of ["amount", "density", "k_v", "outer_radius"]) {
    if (!finiteNumber(value[key]) || Number(value[key]) <= 0) issues.push(`${path}.${key}: positive finite number required`);
  }
  for (const key of ["world_locked", "movable_translation", "movable_rotation", "fixed_far", "visible"]) {
    if (typeof value[key] !== "boolean") issues.push(`${path}.${key}: boolean required`);
  }
  if (value.representation_mode !== "CM_CONTROL" && value.representation_mode !== "RIGID_VOLUME") {
    issues.push(`${path}.representation_mode: CM_CONTROL or RIGID_VOLUME required`);
  }
  if (!Array.isArray(value.voxel_elements) || value.voxel_elements.length === 0) {
    issues.push(`${path}.voxel_elements: non-empty array required`);
  } else {
    let amount = 0;
    value.voxel_elements.forEach((element, elementIndex) => {
      if (!isRecord(element)) {
        issues.push(`${path}.voxel_elements[${elementIndex}]: object required`);
        return;
      }
      if (!vec(element.local_position, 3)) issues.push(`${path}.voxel_elements[${elementIndex}].local_position: vec3 required`);
      if (!finiteNumber(element.amount) || element.amount <= 0) issues.push(`${path}.voxel_elements[${elementIndex}].amount: positive required`);
      else amount += element.amount;
      if (!finiteNumber(element.volume) || element.volume <= 0) issues.push(`${path}.voxel_elements[${elementIndex}].volume: positive required`);
    });
    if (finiteNumber(value.amount) && Math.abs(amount - value.amount) > 1e-10) {
      issues.push(`${path}.amount: voxel ledger ${amount} does not equal declared ${value.amount}`);
    }
  }
  if (!isRecord(value.provenance)) issues.push(`${path}.provenance: object required`);
  return true;
}

export function parseScene(value: unknown): SceneDocument {
  const issues: string[] = [];
  if (!isRecord(value)) throw new ValidationError(["scene: expected object"]);
  if (value.scene_version !== "1.0") issues.push("scene_version: expected 1.0");
  for (const key of ["scene_id", "display_name", "description", "does_not_claim"]) {
    if (typeof value[key] !== "string" || value[key] === "") issues.push(`${key}: non-empty string required`);
  }
  if (!finiteNumber(value.coefficient_c) || value.coefficient_c <= 0) issues.push("coefficient_c: positive finite number required");
  if (!Array.isArray(value.objects) || value.objects.length === 0) issues.push("objects: non-empty array required");
  else {
    value.objects.forEach((object, index) => validateObject(object, index, issues));
    const ids = value.objects.filter(isRecord).map((item) => item.object_id);
    if (new Set(ids).size !== ids.length) issues.push("objects: object_id values must be unique");
  }
  if (!isRecord(value.provenance)) issues.push("provenance: object required");
  if (issues.length) throw new ValidationError(issues);
  return structuredClone(value) as unknown as SceneDocument;
}

export function parsePacket(value: unknown): BrowserPacket {
  const issues: string[] = [];
  if (!isRecord(value)) throw new ValidationError(["packet: expected object"]);
  if (value.packet_version !== "1.0") issues.push("packet_version: expected 1.0");
  for (const key of ["producer_commit", "packet_sha256", "manifest_sha256", "verdict", "claim_ceiling"]) {
    if (typeof value[key] !== "string" || value[key] === "") issues.push(`${key}: non-empty string required`);
  }
  for (const key of ["body_transforms", "body_forces", "body_torques", "amount_ledger"]) {
    if (!Array.isArray(value[key])) issues.push(`${key}: array required`);
  }
  if (!isRecord(value.diagnostics)) issues.push("diagnostics: object required");
  if (!isRecord(value.visual_arrays)) issues.push("visual_arrays: object required");
  if (issues.length) throw new ValidationError(issues);
  return structuredClone(value) as unknown as BrowserPacket;
}

export function rotateVector(vector: Vec3, quaternion: [number, number, number, number]): Vec3 {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}
