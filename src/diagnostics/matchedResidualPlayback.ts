import type { BrowserPacketV2, Vec3 } from "../app/contracts";

export const MATCHED_RESIDUAL_CASE_ORDER = [
  "MR00", "MR01", "MR02", "MR03", "MR04", "MR05", "MR06", "MR07",
  "DL00", "DL01", "DL02", "DL03", "DL04", "DL05", "DL06", "DL07",
] as const;

export type MatchedResidualCaseId = (typeof MATCHED_RESIDUAL_CASE_ORDER)[number];
export type MatchedResidualLane =
  | "CURRENT_G4_SCENE_FAITHFUL_MR_V2"
  | "LEGACY_MATCHED_RESIDUAL_DIAGNOSTIC";

export type MatchedResidualMode = "FORWARD" | "SPECULAR" | "LEGACY_DIAGNOSTIC";

export interface MatchedResidualCasePlayback {
  case_id: MatchedResidualCaseId;
  definition: string;
  lane: MatchedResidualLane;
  classification: string;
  standard_null_status: string;
  current_g4_residual_status: string;
  dimensionless_resultant_status: string;
  si_unit_binding_status: string;
  scene_fidelity_status: string;
  route_class: string;
  observable_kind: string;
  causal_claim_status: string;
  routing_law_selected: false;
  scene_signature: string | null;
  source_commit: string;
  current_action_tally_replay_available: boolean;
  physical_force_available: false;
  physical_seconds_required_for_scene_gate: false;
  standard_null_norm: number;
  resultant_residual: Vec3;
  resultant_residual_norm: number;
  torque_residual: Vec3;
  torque_residual_norm: number;
  mode: MatchedResidualMode;
  same_incident_packet: boolean | null;
  path_depth_consumed_as_action: false | null;
}

export interface MatchedResidualPlayback {
  packet: BrowserPacketV2;
  case_order: readonly MatchedResidualCaseId[];
  cases: Record<MatchedResidualCaseId, MatchedResidualCasePlayback>;
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value)
    && value.length === 3
    && value.every(component => typeof component === "number" && Number.isFinite(component));
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseMatchedResidualPlayback(packet: BrowserPacketV2): MatchedResidualPlayback {
  if (packet.verdict !== "G4_SCENE_FAITHFUL_MR00_MR07_PASS") {
    throw new Error("matched residual packet: unexpected scene-faithful verdict");
  }
  if (packet.diagnostics.dl_current_g4_status !== "NOT_REPLAYED_ON_CURRENT_ACTION_TALLY") {
    throw new Error("matched residual packet: DL lane boundary missing");
  }
  if (packet.diagnostics.dimensionless_resultant_available !== true) {
    throw new Error("matched residual packet: dimensionless resultant is not declared available");
  }
  if (packet.diagnostics.current_research_blocked_by_cadence !== false) {
    throw new Error("matched residual packet: cadence was incorrectly retained as a current gate");
  }
  if (packet.diagnostics.physical_force_available !== false) {
    throw new Error("matched residual packet: SI force binding must remain unavailable");
  }

  const visual = packet.visual_arrays as { case_order?: unknown; cases?: unknown };
  if (JSON.stringify(visual.case_order) !== JSON.stringify(MATCHED_RESIDUAL_CASE_ORDER)) {
    throw new Error("matched residual packet: case order mismatch");
  }
  if (!visual.cases || typeof visual.cases !== "object") {
    throw new Error("matched residual packet: cases missing");
  }

  const cases = visual.cases as Record<string, MatchedResidualCasePlayback>;
  for (const caseId of MATCHED_RESIDUAL_CASE_ORDER) {
    const item = cases[caseId];
    if (!item || item.case_id !== caseId || !item.classification) {
      throw new Error(`matched residual packet: invalid ${caseId}`);
    }
    if (!isVec3(item.resultant_residual) || !isVec3(item.torque_residual)) {
      throw new Error(`matched residual packet: invalid vectors in ${caseId}`);
    }
    if (!isFiniteNonNegative(item.standard_null_norm)
      || !isFiniteNonNegative(item.resultant_residual_norm)
      || !isFiniteNonNegative(item.torque_residual_norm)) {
      throw new Error(`matched residual packet: invalid norms in ${caseId}`);
    }
    if (item.physical_seconds_required_for_scene_gate !== false) {
      throw new Error(`matched residual packet: physical seconds incorrectly required in ${caseId}`);
    }
    if (item.routing_law_selected !== false) {
      throw new Error(`matched residual packet: routing-law promotion in ${caseId}`);
    }
    if (caseId.startsWith("MR") && (
      item.lane !== "CURRENT_G4_SCENE_FAITHFUL_MR_V2"
      || !item.current_action_tally_replay_available
      || item.scene_fidelity_status !== "EXACT"
    )) {
      throw new Error(`matched residual packet: MR lane/fidelity mismatch in ${caseId}`);
    }
    if (caseId.startsWith("DL") && (
      item.lane !== "LEGACY_MATCHED_RESIDUAL_DIAGNOSTIC"
      || item.current_action_tally_replay_available
    )) {
      throw new Error(`matched residual packet: DL lane mismatch in ${caseId}`);
    }
    if (item.physical_force_available !== false) {
      throw new Error(`matched residual packet: SI force firewall missing in ${caseId}`);
    }
  }

  const mrSignatures = MATCHED_RESIDUAL_CASE_ORDER
    .filter(caseId => caseId.startsWith("MR"))
    .map(caseId => cases[caseId].scene_signature);
  if (mrSignatures.some(signature => !signature) || new Set(mrSignatures).size !== 8) {
    throw new Error("matched residual packet: MR scene signatures are missing or duplicated");
  }

  return {
    packet: structuredClone(packet),
    case_order: MATCHED_RESIDUAL_CASE_ORDER,
    cases: structuredClone(cases) as Record<MatchedResidualCaseId, MatchedResidualCasePlayback>,
  };
}

export function matchedVectorNorm(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
