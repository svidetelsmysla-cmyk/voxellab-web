import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R12_G4_ACTION_TALLY_BROWSER_PLAYBACK_V1.json";
import {
  ACTION_TALLY_GATE_ORDER,
  ACTION_TALLY_METRIC_ORDER,
  buildActionTallyAudit,
} from "../src/diagnostics/actionTallyAuditPanel";
import { parseBrowserPacketV2 } from "../src/packets/authority";

describe("G4 ActionTally public audit panel", () => {
  it("verifies eight full gates, two scoped controls, residuals and five branches", () => {
    const audit = buildActionTallyAudit(parseBrowserPacketV2(packetJson));
    expect(audit.status).toBe("PACKET_AUDIT_PASS_WITH_SCOPED_CONTROLS");
    expect(audit.gates.map(item => item.gate)).toEqual(ACTION_TALLY_GATE_ORDER);
    expect(audit.metrics.map(item => item.metric)).toEqual(ACTION_TALLY_METRIC_ORDER);
    expect(audit.gates.find(item => item.gate === "G9_MIRROR_ROTATION_COVARIANCE")?.status).toBe("R2_SPECULAR_CONTROL_ONLY_PASS");
    expect(audit.gates.find(item => item.gate === "G10_MATCHED_STANDARD_NULL")?.status).toBe("ONE_POINT_SYMMETRY_CONTROL_ONLY");
    expect(audit.secondary_verdict).toBe("SI_TIME_AND_FORCE_UNIT_BINDING_DEFERRED_NOT_CURRENT_BLOCKER");
    expect(audit.branches).toHaveLength(5);
    expect(audit.branches.every(item => Math.abs(item.m0_residual) <= 1e-12)).toBe(true);
    expect(audit.branches.every(item => Math.abs(item.deficit_route_residual) <= 1e-12)).toBe(true);
  });

  it("exposes bounded public coverage without inventing missing channel arrays", () => {
    const audit = buildActionTallyAudit(parseBrowserPacketV2(packetJson));
    expect(audit.channel_coverage).toHaveLength(10);
    expect(audit.channel_coverage.find(item => item.channel === "incident_action")?.public_projection).toContain("incident_m0");
    expect(audit.channel_coverage.find(item => item.channel === "redirected_action")?.public_projection).toBe("NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1");
    expect(audit.channel_coverage.find(item => item.channel === "resolved_minus_homogenized")?.physical_sign).toBe("SIGNED_DIAGNOSTIC");
  });

  it("blocks a broken gate or a false cadence/SI status", () => {
    const brokenGate = structuredClone(packetJson) as any;
    brokenGate.diagnostics.gate_matrix.G5_RESULTANT_PARITY = "FAIL";
    expect(() => buildActionTallyAudit(parseBrowserPacketV2(brokenGate))).toThrow(/G5_RESULTANT_PARITY/);

    const falseCadenceBlock = structuredClone(packetJson) as any;
    falseCadenceBlock.diagnostics.current_research_blocked_by_cadence = true;
    expect(() => buildActionTallyAudit(parseBrowserPacketV2(falseCadenceBlock))).toThrow(/cadence/i);

    const hiddenSiPromotion = structuredClone(packetJson) as any;
    hiddenSiPromotion.diagnostics.physical_force_available = true;
    expect(() => buildActionTallyAudit(parseBrowserPacketV2(hiddenSiPromotion))).toThrow(/SI force/i);
  });
});
