import type { BrowserPacketV2, Vec3 } from "../app/contracts";

export const ACTION_TALLY_BRANCH_ORDER = [
  "H0_HOMOGENIZED",
  "R0_FORWARD_PRESERVING",
  "R1_ISOTROPIC_REDIRECTION",
  "R2_SPECULAR_REDIRECTION",
  "R3_SOURCE_COMPATIBLE_CANDIDATE",
] as const;

export type ActionTallyBranchId = (typeof ACTION_TALLY_BRANCH_ORDER)[number];
export type ActionTallyBodyId = "receiver" | "structure";

export interface ActionTallyBranchPlayback {
  event_count: number;
  incident_m0: number;
  m0_residual: number;
  deficit_route_residual: number;
  package_hash: string;
  event_ledger_hash: string;
  receiver_resultant: Vec3;
  structure_resultant: Vec3;
  receiver_torque: Vec3;
  structure_torque: Vec3;
  receiver_resultant_delta: Vec3;
  structure_resultant_delta: Vec3;
  receiver_torque_delta: Vec3;
  structure_torque_delta: Vec3;
}

export interface ActionTallyPlayback {
  packet: BrowserPacketV2;
  branch_order: readonly ActionTallyBranchId[];
  branches: Record<ActionTallyBranchId, ActionTallyBranchPlayback>;
}

const vectorFields = [
  "receiver_resultant",
  "structure_resultant",
  "receiver_torque",
  "structure_torque",
  "receiver_resultant_delta",
  "structure_resultant_delta",
  "receiver_torque_delta",
  "structure_torque_delta",
] as const;

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(component => typeof component === "number" && Number.isFinite(component));
}

export function parseActionTallyPlayback(packet: BrowserPacketV2): ActionTallyPlayback {
  if (packet.verdict !== "ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS") throw new Error("action tally packet: unexpected verdict");
  if (packet.diagnostics.secondary_verdict !== "CADENCE_TO_FORCE_BLOCKER") throw new Error("action tally packet: cadence firewall missing");
  if (packet.diagnostics.physical_force_available !== false) throw new Error("action tally packet: physical force must remain unavailable");
  const visual = packet.visual_arrays as { branch_order?: unknown; branches?: unknown };
  if (JSON.stringify(visual.branch_order) !== JSON.stringify(ACTION_TALLY_BRANCH_ORDER)) throw new Error("action tally packet: branch order mismatch");
  if (!visual.branches || typeof visual.branches !== "object") throw new Error("action tally packet: branches missing");
  const branches = visual.branches as Record<string, ActionTallyBranchPlayback>;
  for (const branchId of ACTION_TALLY_BRANCH_ORDER) {
    const branch = branches[branchId];
    if (!branch || typeof branch.event_count !== "number" || !Number.isFinite(branch.incident_m0)) throw new Error(`action tally packet: invalid ${branchId}`);
    for (const field of vectorFields) if (!isVec3(branch[field])) throw new Error(`action tally packet: invalid ${branchId}.${field}`);
  }
  return { packet: structuredClone(packet), branch_order: ACTION_TALLY_BRANCH_ORDER, branches: structuredClone(branches) as Record<ActionTallyBranchId, ActionTallyBranchPlayback> };
}

export function vectorNorm(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function actionTallyVectors(branch: ActionTallyBranchPlayback, body: ActionTallyBodyId) {
  return {
    resultant: branch[`${body}_resultant`],
    resultant_delta: branch[`${body}_resultant_delta`],
    torque: branch[`${body}_torque`],
    torque_delta: branch[`${body}_torque_delta`],
  };
}
