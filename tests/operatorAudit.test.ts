import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R6_OPERATOR_AUDIT_A1_BROWSER_PLAYBACK_V1.json";
import { parseOperatorAuditPacket } from "../src/operatorAudit/packet";


describe("Operator Audit A1 governed playback", () => {
  const packet = parseOperatorAuditPacket(packetJson);

  it("locks exact scientific authority and bounded verdicts", () => {
    expect(packet.authority).toBe("READ_ONLY_GOVERNED_PUBLIC_PROJECTION");
    expect(packet.main_verdict).toBe("ADDITIVE_SOURCE_ZERO_FIRST_HIT_NONZERO_OPERATOR_DELTA_PASS");
    expect(packet.secondary_verdict).toBe("FIRST_HIT_DIRECT_SUPPORT_IS_BINARY_ANGULAR_COVERAGE_NOT_WQN_ACTION");
    expect(packet.source_audit_verdict).toBe("SOURCE_REDIRECTION_CONSTITUTIVE_LAW_NOT_FOUND");
    expect(packet.event_geometry_verdict).toBe("FIRST_HIT_EVENT_GEOMETRY_EXPORT_PASS_SOURCE_KERNEL_UNDERDETERMINED");
  });

  it("keeps source-additive zero distinct from project first-hit nonzero", () => {
    expect(packet.lanes.map(lane => lane.id)).toEqual(["S0", "S1", "S2", "S3"]);
    expect(packet.lanes[0]?.a_minus_b_norm).toBe(0);
    expect(packet.lanes[1]?.a_minus_b_norm).toBe(0);
    expect(packet.lanes[2]?.a_minus_b_norm).toBeCloseTo(0.42518552273726734, 14);
    expect(packet.lanes[3]?.a_minus_b_norm).toBeNull();
    expect(packet.first_hit.consumes_source_amount).toBe(false);
    expect(packet.first_hit.consumes_source_distance).toBe(false);
    expect(packet.first_hit.consumes_chord_length).toBe(false);
    expect(packet.first_hit.consumes_density).toBe(false);
  });

  it("preserves refinement and reachable-set ceilings", () => {
    expect(packet.refinement).toHaveLength(5);
    expect(packet.refinement.at(-1)?.directions).toBe(49152);
    expect(packet.refinement.at(-1)?.delta_d1_norm).toBeCloseTo(packet.first_hit.delta_d1_norm, 14);
    expect(packet.reachable_set.joint_source_constrained_zero_membership).toBe("NOT_IDENTIFIED");
    expect(packet.reachable_set.projection_rows).toHaveLength(3);
    expect(packet.reachable_set.projection_rows.every(row => row.contains_zero)).toBe(true);
  });

  it("keeps all physical-promotion firewalls closed", () => {
    expect(packet.claim_ceiling.dimensionless_operator_delta).toBe(true);
    expect(packet.claim_ceiling.first_scientific_viktor_residual).toBe(false);
    expect(packet.claim_ceiling.routing_law_selected).toBe(false);
    expect(packet.claim_ceiling.physical_seconds_required).toBe(false);
    expect(packet.claim_ceiling.si_time_force_binding).toBe("DEFERRED");
    expect(packet.claim_ceiling.upor).toBe(false);
    expect(packet.claim_ceiling.dipole).toBe(false);
    expect(packet.claim_ceiling.scale_binding).toBe(false);
    expect(packet.claim_ceiling.validation).toBe(false);
    expect(packet.claim_ceiling.canon_promotion).toBe(false);
  });
});
