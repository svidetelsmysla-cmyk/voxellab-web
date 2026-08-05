import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R12_MR_DL_MATCHED_RESIDUAL_BROWSER_PLAYBACK_V1.json";
import { MATCHED_RESIDUAL_CASE_ORDER, matchedVectorNorm, parseMatchedResidualPlayback } from "../src/diagnostics/matchedResidualPlayback";
import { parseBrowserPacketV2 } from "../src/packets/authority";

describe("MR00-MR07 and DL00-DL07 governed playback", () => {
  const playback = parseMatchedResidualPlayback(parseBrowserPacketV2(packetJson));

  it("locks the current G4 and legacy packet identities without combining their authority", () => {
    expect(playback.packet.diagnostics.current_g4_source_commit).toBe("3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba");
    expect(playback.packet.diagnostics.current_g4_source_npz_sha256).toBe("952c35c79940150860e03acf7cb3c5206242d554d999ad9b6ba91e3b4b6df7af");
    expect(playback.packet.diagnostics.legacy_source_commit).toBe("586a891e408fdf595702278c80f55da7d871d8de");
    expect(playback.packet.diagnostics.legacy_source_npz_sha256).toBe("43d3d1fe0a60172cee214ba76990487ac46c81e78f7a21395fa7004af7e1cc03");
    expect(playback.packet.diagnostics.dl_current_g4_status).toBe("NOT_REPLAYED_ON_CURRENT_ACTION_TALLY");
    expect(playback.packet.diagnostics.physical_force_available).toBe(false);
  });

  it("contains all 16 exact case identities and source definitions", () => {
    expect(playback.case_order).toEqual(MATCHED_RESIDUAL_CASE_ORDER);
    expect(playback.case_order).toHaveLength(16);
    expect(playback.cases.MR04.definition).toBe("matched first-hit overlap-order pair");
    expect(playback.cases.DL01.definition).toBe("asymmetric L1B kinematic mismatch");
    expect(playback.cases.DL07.definition).toBe("standard Dzhanibekov/gyroscope exclusion control");
  });

  it("keeps MR standard-null classification separate from current ActionTally deltas", () => {
    for (const caseId of MATCHED_RESIDUAL_CASE_ORDER.slice(0, 8)) {
      const item = playback.cases[caseId];
      expect(item.lane).toBe("CURRENT_G4_ACTION_TALLY_REPLAY");
      expect(item.standard_null_norm).toBeLessThan(1e-12);
      expect(matchedVectorNorm(item.resultant_residual)).toBeCloseTo(item.resultant_residual_norm, 14);
      expect(matchedVectorNorm(item.torque_residual)).toBeCloseTo(item.torque_residual_norm, 14);
      expect(item.physical_force_available).toBe(false);
    }
    expect(playback.cases.MR00.resultant_residual_norm).toBe(0);
    expect(playback.cases.MR02.resultant_residual_norm).toBeGreaterThan(0);
  });

  it("publishes DL only as the available legacy zero-within-floor diagnostic", () => {
    for (const caseId of MATCHED_RESIDUAL_CASE_ORDER.slice(8)) {
      const item = playback.cases[caseId];
      expect(item.lane).toBe("LEGACY_MATCHED_RESIDUAL_DIAGNOSTIC");
      expect(item.current_action_tally_replay_available).toBe(false);
      expect(item.classification).toBe("ZERO_WITHIN_FLOOR");
      expect(item.resultant_residual_norm).toBe(0);
      expect(item.torque_residual_norm).toBe(0);
      expect(item.physical_force_available).toBe(false);
    }
  });
});
