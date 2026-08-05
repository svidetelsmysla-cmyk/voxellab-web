import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R12_MR_DL_MATCHED_RESIDUAL_BROWSER_PLAYBACK_V1.json";
import {
  MATCHED_RESIDUAL_CASE_ORDER,
  matchedVectorNorm,
  parseMatchedResidualPlayback,
} from "../src/diagnostics/matchedResidualPlayback";
import { parseBrowserPacketV2 } from "../src/packets/authority";

describe("scene-faithful MR00-MR07 V2 and legacy DL playback", () => {
  const playback = parseMatchedResidualPlayback(parseBrowserPacketV2(packetJson));

  it("locks the repaired producer and separates dimensionless resultants from SI binding", () => {
    expect(playback.packet.verdict).toBe("G4_SCENE_FAITHFUL_MR00_MR07_PASS");
    expect(playback.packet.diagnostics.current_g4_source_commit).toBe("2219fdc3fa2c6fd15d07befd4680175239061508");
    expect(playback.packet.diagnostics.current_g4_source_scene_matrix_sha256).toBe("e138aa9603d5ba18e82021ffe7917024c2162ed9c56b56184a614a3174bae682");
    expect(playback.packet.diagnostics.dimensionless_resultant_available).toBe(true);
    expect(playback.packet.diagnostics.current_research_blocked_by_cadence).toBe(false);
    expect(playback.packet.diagnostics.physical_time_binding_status).toBe("NOT_BOUND_NOT_REQUIRED_FOR_CURRENT_GATE");
    expect(playback.packet.diagnostics.physical_force_unit_binding_status).toBe("NOT_BOUND_DEFERRED");
    expect(playback.packet.diagnostics.routing_law_selected).toBe(false);
    expect(playback.packet.diagnostics.first_scientific_viktor_residual_established).toBe(false);
  });

  it("contains eight unique repaired MR scenes plus eight legacy DL rows", () => {
    expect(playback.case_order).toEqual(MATCHED_RESIDUAL_CASE_ORDER);
    expect(playback.case_order).toHaveLength(16);
    const signatures = MATCHED_RESIDUAL_CASE_ORDER.slice(0, 8).map(id => playback.cases[id].scene_signature);
    expect(signatures.every(Boolean)).toBe(true);
    expect(new Set(signatures).size).toBe(8);
    expect(playback.cases.MR04.definition).toBe("three-body overlapping-sphere first-hit order pair");
    expect(playback.cases.MR05.observable_kind).toBe("TRANSVERSE_PROJECTION_NULL");
    expect(playback.cases.MR06.observable_kind).toBe("TORQUE_NULL");
    expect(playback.cases.MR07.observable_kind).toBe("REPRESENTATION_REFINEMENT");
  });

  it("reports exact controls without the old universal ZERO_WITHIN_FLOOR label", () => {
    for (const caseId of MATCHED_RESIDUAL_CASE_ORDER.slice(0, 8)) {
      const item = playback.cases[caseId];
      expect(item.lane).toBe("CURRENT_G4_SCENE_FAITHFUL_MR_V2");
      expect(item.scene_fidelity_status).toBe("EXACT");
      expect(item.dimensionless_resultant_status).toBe("AVAILABLE");
      expect(item.si_unit_binding_status).toBe("DEFERRED_NOT_CURRENT_BLOCKER");
      expect(item.physical_seconds_required_for_scene_gate).toBe(false);
      expect(item.routing_law_selected).toBe(false);
      expect(matchedVectorNorm(item.resultant_residual)).toBeCloseTo(item.resultant_residual_norm, 14);
      expect(matchedVectorNorm(item.torque_residual)).toBeCloseTo(item.torque_residual_norm, 14);
    }
    expect(playback.cases.MR00.classification).toBe("ZERO_WITHIN_TOLERANCE");
    expect(playback.cases.MR04.classification).toBe("NONZERO_SPECULAR_CONTROL_RESIDUAL");
    expect(playback.cases.MR04.standard_null_norm).toBe(0);
    expect(playback.cases.MR04.resultant_residual_norm).toBeGreaterThan(0.8);
    expect(playback.cases.MR04.causal_claim_status).toBe("ROUTING_LAW_NOT_SELECTED");
  });

  it("preserves DL only as legacy, not current-G4 evidence", () => {
    for (const caseId of MATCHED_RESIDUAL_CASE_ORDER.slice(8)) {
      const item = playback.cases[caseId];
      expect(item.lane).toBe("LEGACY_MATCHED_RESIDUAL_DIAGNOSTIC");
      expect(item.current_action_tally_replay_available).toBe(false);
      expect(item.classification).toBe("LEGACY_ZERO_WITHIN_FLOOR");
      expect(item.current_g4_residual_status).toBe("NOT_REPLAYED_ON_CURRENT_ACTION_TALLY");
      expect(item.scene_fidelity_status).toBe("LEGACY_NOT_REPLAYED_CURRENT_G4");
      expect(item.resultant_residual_norm).toBe(0);
      expect(item.torque_residual_norm).toBe(0);
    }
  });
});
