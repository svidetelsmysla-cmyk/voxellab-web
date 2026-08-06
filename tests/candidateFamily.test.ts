import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R6_BODY_RESPONSE_CANDIDATE_FAMILY_A1_1_BROWSER_PLAYBACK_V1.json";
import { parseCandidateFamilyPacket } from "../src/operatorAudit/candidateFamilyPacket";


describe("Operator Audit A1.1 candidate-family playback", () => {
  const packet = parseCandidateFamilyPacket(packetJson);

  it("locks the exact governed scientific packet", () => {
    expect(packet.scientific_head).toBe("0aea06528f638dc702c210776947c916e93c2266");
    expect(packet.workflow_run).toBe(31085172957);
    expect(packet.artifact_id).toBe(8961091423);
    expect(packet.artifact_sha256).toBe("ca852e06a94c4de22bf40dc4cec9707427e7bf0ed1e3629bf61d287c6db6751a");
    expect(packet.main_verdict).toBe("MINIMAL_CONTROL_FAMILY_CONTAINS_EXACT_ZERO");
    expect(packet.secondary_verdict).toBe("NONFORWARD_CONTROL_HULL_EXCLUDES_ZERO");
  });

  it("keeps forward zero and family-specific nonforward exclusion separate", () => {
    expect(packet.candidates).toHaveLength(5);
    expect(packet.candidates[0]?.candidate_id).toBe("C0_FORWARD_TRANSMISSION");
    expect(packet.candidates[0]?.resultant_norm).toBeLessThan(5e-12);
    expect(packet.candidates[0]?.torque_norm).toBe(0);
    expect(packet.hulls.all_resultant.contains_zero).toBe(true);
    expect(packet.hulls.all_joint.contains_zero).toBe(true);
    expect(packet.hulls.nonforward_resultant.contains_zero).toBe(false);
    expect(packet.hulls.nonforward_joint.contains_zero).toBe(false);
    expect(packet.hulls.nonforward_resultant.minimum_distance).toBeCloseTo(0.4251855227372447, 14);
  });

  it("retains the project-candidate and physical-promotion ceilings", () => {
    expect(packet.candidate_source_class).toBe("PROJECT_CONSTITUTIVE_CANDIDATES_NOT_VIKTOR_LAW");
    expect(packet.logical_delta.nonzero_full_residual_forced_by_minimal_principles).toBe(false);
    expect(packet.claim_ceiling.routing_law_selected).toBe(false);
    expect(packet.claim_ceiling.first_scientific_viktor_residual).toBe(false);
    expect(packet.claim_ceiling.physical_seconds_required).toBe(false);
    expect(packet.claim_ceiling.si_time_force_binding).toBe("DEFERRED");
    expect(packet.claim_ceiling.upor).toBe(false);
    expect(packet.claim_ceiling.dipole).toBe(false);
    expect(packet.claim_ceiling.scale_binding).toBe(false);
    expect(packet.claim_ceiling.validation).toBe(false);
    expect(packet.claim_ceiling.canon_promotion).toBe(false);
  });
});
