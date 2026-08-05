import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R12_G4_ACTION_TALLY_BROWSER_PLAYBACK_V1.json";
import { ACTION_TALLY_BRANCH_ORDER, actionTallyVectors, parseActionTallyPlayback, vectorNorm } from "../src/diagnostics/actionTallyPlayback";
import { parseBrowserPacketV2 } from "../src/packets/authority";

describe("G4 governed ActionTally playback", () => {
  const playback = parseActionTallyPlayback(parseBrowserPacketV2(packetJson));

  it("locks exact source identity and the cadence firewall", () => {
    expect(playback.packet.producer_commit).toBe("3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba");
    expect(playback.packet.packet_sha256).toBe("952c35c79940150860e03acf7cb3c5206242d554d999ad9b6ba91e3b4b6df7af");
    expect(playback.packet.manifest_sha256).toBe("9829c1c8b48a26a900149a48b3d8e0cd03700938721d914f601b0bf83581af9b");
    expect(playback.packet.verdict).toBe("ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS");
    expect(playback.packet.diagnostics.secondary_verdict).toBe("CADENCE_TO_FORCE_BLOCKER");
    expect(playback.packet.diagnostics.physical_force_available).toBe(false);
    expect(playback.packet.claim_ceiling).toContain("NOT_PHYSICAL_FORCE");
  });

  it("retains the complete H0/R0-R3 branch order and closes every gate", () => {
    expect(playback.branch_order).toEqual(ACTION_TALLY_BRANCH_ORDER);
    expect(Object.values(playback.packet.diagnostics.gate_matrix as Record<string, string>)).toEqual(Array(10).fill("PASS"));
    for (const branch of Object.values(playback.branches)) {
      expect(branch.incident_m0).toBe(12.566697273858505);
      expect(branch.m0_residual).toBe(0);
    }
  });

  it("keeps R0 as the exact forward null and signed deltas as diagnostics", () => {
    const r0 = playback.branches.R0_FORWARD_PRESERVING;
    for (const body of ["receiver", "structure"] as const) {
      const vectors = actionTallyVectors(r0, body);
      expect(vectorNorm(vectors.resultant_delta)).toBe(0);
      expect(vectorNorm(vectors.torque_delta)).toBe(0);
    }
    for (const branchId of ["R1_ISOTROPIC_REDIRECTION", "R2_SPECULAR_REDIRECTION", "R3_SOURCE_COMPATIBLE_CANDIDATE"] as const) {
      const branch = playback.branches[branchId];
      const resultantClosure = branch.receiver_resultant_delta.map((value, axis) => value + branch.structure_resultant_delta[axis]!) as [number, number, number];
      expect(vectorNorm(resultantClosure)).toBeLessThan(1e-14);
    }
  });
});
