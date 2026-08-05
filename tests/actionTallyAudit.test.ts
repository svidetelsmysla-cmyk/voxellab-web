import { describe, expect, it } from "vitest";
import packetJson from "../public/packets/R12_G4_ACTION_TALLY_BROWSER_PLAYBACK_V1.json";
import {
  ACTION_TALLY_GATE_ORDER,
  ACTION_TALLY_METRIC_ORDER,
  buildActionTallyAudit,
} from "../src/diagnostics/actionTallyAuditPanel";
import { parseBrowserPacketV2 } from "../src/packets/authority";

describe("G4 ActionTally public audit panel", () => {
  it("verifies all ten gates, residual metrics and five branches", () => {
    const audit = buildActionTallyAudit(parseBrowserPacketV2(packetJson));
    expect(audit.status).toBe("PACKET_AUDIT_PASS");
    expect(audit.gates.map(item => item.gate)).toEqual(ACTION_TALLY_GATE_ORDER);
    expect(audit.metrics.map(item => item.metric)).toEqual(ACTION_TALLY_METRIC_ORDER);
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

  it("blocks a broken gate or a removed cadence firewall", () => {
    const brokenGate = structuredClone(packetJson) as any;
    brokenGate.diagnostics.gate_matrix.G5_RESULTANT_PARITY = "FAIL";
    expect(() => buildActionTallyAudit(parseBrowserPacketV2(brokenGate))).toThrow(/G5_RESULTANT_PARITY/);

    const brokenCadence = structuredClone(packetJson) as any;
    brokenCadence.diagnostics.physical_force_available = true;
    expect(() => buildActionTallyAudit(parseBrowserPacketV2(brokenCadence))).toThrow(/physical force/i);
  });
});
