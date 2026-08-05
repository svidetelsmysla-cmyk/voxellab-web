import type { BrowserPacketV2, Vec3 } from "../app/contracts";
import {
  ACTION_TALLY_BRANCH_ORDER,
  parseActionTallyPlayback,
  vectorNorm,
  type ActionTallyBranchId,
  type ActionTallyBranchPlayback,
} from "./actionTallyPlayback";
import { parseBrowserPacketV2 } from "../packets/authority";

const PACKET_FILE = "R12_G4_ACTION_TALLY_BROWSER_PLAYBACK_V1.json";
const EXPECTED_VERDICT = "ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS";
const EXPECTED_CLAIM_CEILING = "DIMENSIONLESS_ACTION_TALLY_RESULTANT_NOT_SI_FORCE_NOT_VALIDATION";
const EXPECTED_SECONDARY = "SI_TIME_AND_FORCE_UNIT_BINDING_DEFERRED_NOT_CURRENT_BLOCKER";
const EXPECTED_PROJECTION = "BOUNDED_SUMMARY_FROM_GOVERNED_PACKET_NO_CELL_ARRAYS";
const HASH40 = /^[0-9a-f]{40}$/;
const HASH64 = /^[0-9a-f]{64}$/;
const EPS = 1e-12;

export const ACTION_TALLY_GATE_ORDER = [
  "G1_PROVENANCE",
  "G2_COMMON_TYPED_PACKAGE",
  "G3_IDENTICAL_INCIDENT_PACKETS",
  "G4_SCALAR_M0_CLOSURE",
  "G5_RESULTANT_PARITY",
  "G6_TORQUE_PARITY",
  "G7_NO_DOUBLE_DELTA_OMEGA",
  "G8_FORWARD_ZERO_RESIDUAL",
  "G9_MIRROR_ROTATION_COVARIANCE",
  "G10_MATCHED_STANDARD_NULL",
] as const;

const EXPECTED_GATE_STATUS: Record<(typeof ACTION_TALLY_GATE_ORDER)[number], string> = {
  G1_PROVENANCE: "PASS",
  G2_COMMON_TYPED_PACKAGE: "PASS",
  G3_IDENTICAL_INCIDENT_PACKETS: "PASS",
  G4_SCALAR_M0_CLOSURE: "PASS",
  G5_RESULTANT_PARITY: "PASS",
  G6_TORQUE_PARITY: "PASS",
  G7_NO_DOUBLE_DELTA_OMEGA: "PASS",
  G8_FORWARD_ZERO_RESIDUAL: "PASS",
  G9_MIRROR_ROTATION_COVARIANCE: "R2_SPECULAR_CONTROL_ONLY_PASS",
  G10_MATCHED_STANDARD_NULL: "ONE_POINT_SYMMETRY_CONTROL_ONLY",
};

export const ACTION_TALLY_METRIC_ORDER = [
  "maximum_m0_residual",
  "maximum_deficit_route_residual",
  "maximum_resultant_parity_residual",
  "maximum_torque_parity_residual",
  "r0_maximum_residual",
  "rotation_resultant_residual",
  "rotation_torque_residual",
  "mirror_resultant_residual",
] as const;

export interface ActionTallyBranchAuditRow {
  branch_id: ActionTallyBranchId;
  event_count: number;
  incident_m0: number;
  m0_residual: number;
  deficit_route_residual: number;
  receiver_resultant_norm: number;
  structure_resultant_norm: number;
  receiver_delta_norm: number;
  structure_delta_norm: number;
  structure_torque_norm: number;
  package_hash: string;
  event_ledger_hash: string;
}

export interface ActionTallyChannelCoverage {
  channel: string;
  physical_sign: "POSITIVE" | "SIGNED_DIAGNOSTIC";
  public_projection: string;
}

export interface ActionTallyAudit {
  status: "PACKET_AUDIT_PASS_WITH_SCOPED_CONTROLS";
  producer_commit: string;
  packet_sha256: string;
  manifest_sha256: string;
  verdict: string;
  claim_ceiling: string;
  secondary_verdict: string;
  public_projection_status: string;
  incident_packet_hash: string;
  gates: Array<{ gate: string; status: string }>;
  metrics: Array<{ metric: string; value: number }>;
  branches: ActionTallyBranchAuditRow[];
  channel_coverage: ActionTallyChannelCoverage[];
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown, name: string): Record<string, unknown> {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
  return value as Record<string, unknown>;
}

function finite(value: unknown, name: string): number {
  requireCondition(typeof value === "number" && Number.isFinite(value), `${name} must be finite`);
  return value;
}

function nonempty(value: unknown, name: string): string {
  requireCondition(typeof value === "string" && value.length > 0, `${name} must be a non-empty string`);
  return value;
}

function add(left: Vec3, right: Vec3): Vec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function auditBranch(branchId: ActionTallyBranchId, branch: ActionTallyBranchPlayback): ActionTallyBranchAuditRow {
  requireCondition(Number.isInteger(branch.event_count) && branch.event_count >= 0, `${branchId}.event_count invalid`);
  requireCondition(Number.isFinite(branch.incident_m0) && branch.incident_m0 > 0, `${branchId}.incident_m0 invalid`);
  requireCondition(Number.isFinite(branch.m0_residual), `${branchId}.m0_residual invalid`);
  requireCondition(Number.isFinite(branch.deficit_route_residual), `${branchId}.deficit_route_residual invalid`);
  requireCondition(HASH64.test(branch.package_hash), `${branchId}.package_hash invalid`);
  requireCondition(HASH64.test(branch.event_ledger_hash), `${branchId}.event_ledger_hash invalid`);
  requireCondition(Math.abs(branch.m0_residual) <= EPS, `${branchId}.m0_residual exceeds tolerance`);
  requireCondition(Math.abs(branch.deficit_route_residual) <= EPS, `${branchId}.deficit_route_residual exceeds tolerance`);
  return {
    branch_id: branchId,
    event_count: branch.event_count,
    incident_m0: branch.incident_m0,
    m0_residual: branch.m0_residual,
    deficit_route_residual: branch.deficit_route_residual,
    receiver_resultant_norm: vectorNorm(branch.receiver_resultant),
    structure_resultant_norm: vectorNorm(branch.structure_resultant),
    receiver_delta_norm: vectorNorm(branch.receiver_resultant_delta),
    structure_delta_norm: vectorNorm(branch.structure_resultant_delta),
    structure_torque_norm: vectorNorm(branch.structure_torque),
    package_hash: branch.package_hash,
    event_ledger_hash: branch.event_ledger_hash,
  };
}

export function buildActionTallyAudit(packet: BrowserPacketV2): ActionTallyAudit {
  const playback = parseActionTallyPlayback(packet);
  requireCondition(packet.verdict === EXPECTED_VERDICT, "ActionTally audit: unexpected verdict");
  requireCondition(packet.claim_ceiling === EXPECTED_CLAIM_CEILING, "ActionTally audit: claim ceiling mismatch");
  requireCondition(HASH40.test(packet.producer_commit), "ActionTally audit: producer commit must be a full SHA");
  requireCondition(HASH64.test(packet.packet_sha256), "ActionTally audit: source packet hash must be SHA256");
  requireCondition(HASH64.test(packet.manifest_sha256), "ActionTally audit: source manifest hash must be SHA256");

  const diagnostics = packet.diagnostics;
  requireCondition(diagnostics.secondary_verdict === EXPECTED_SECONDARY, "ActionTally audit: SI-binding status missing");
  requireCondition(diagnostics.dimensionless_resultant_available === true, "ActionTally audit: dimensionless resultant missing");
  requireCondition(diagnostics.current_research_blocked_by_cadence === false, "ActionTally audit: cadence incorrectly blocks current research");
  requireCondition(diagnostics.physical_force_available === false, "ActionTally audit: SI force units must remain unbound");
  requireCondition(diagnostics.public_projection_status === EXPECTED_PROJECTION, "ActionTally audit: public projection boundary mismatch");
  requireCondition(diagnostics.no_private_corpus === true, "ActionTally audit: private-corpus firewall missing");
  const incidentPacketHash = nonempty(diagnostics.incident_packet_hash, "incident_packet_hash");
  requireCondition(HASH64.test(incidentPacketHash), "ActionTally audit: incident packet hash must be SHA256");

  const gateMatrix = record(diagnostics.gate_matrix, "gate_matrix");
  const gates = ACTION_TALLY_GATE_ORDER.map(gate => {
    const expected = EXPECTED_GATE_STATUS[gate];
    requireCondition(gateMatrix[gate] === expected, `ActionTally audit: ${gate} has unexpected scope/status`);
    return { gate, status: expected };
  });
  requireCondition(Object.keys(gateMatrix).length === ACTION_TALLY_GATE_ORDER.length, "ActionTally audit: unexpected gate-matrix width");

  const rawMetrics = record(diagnostics.metrics, "metrics");
  const metrics = ACTION_TALLY_METRIC_ORDER.map(metric => ({ metric, value: finite(rawMetrics[metric], `metrics.${metric}`) }));
  for (const item of metrics) requireCondition(Math.abs(item.value) <= EPS, `ActionTally audit: ${item.metric} exceeds tolerance`);

  const branches = ACTION_TALLY_BRANCH_ORDER.map(branchId => auditBranch(branchId, playback.branches[branchId]));
  const firstBranch = branches.at(0);
  requireCondition(firstBranch !== undefined, "ActionTally audit: no branches exported");
  for (const row of branches) requireCondition(Math.abs(row.incident_m0 - firstBranch.incident_m0) <= EPS, `${row.branch_id}: incident M0 mismatch`);

  const h0 = playback.branches.H0_HOMOGENIZED;
  const r0 = playback.branches.R0_FORWARD_PRESERVING;
  requireCondition(h0.event_count === 0, "ActionTally audit: H0 must contain no redirection events");
  requireCondition(r0.event_count > 0, "ActionTally audit: R0 must exercise first-hit routing");
  for (const value of [
    h0.receiver_resultant_delta,
    h0.structure_resultant_delta,
    h0.receiver_torque_delta,
    h0.structure_torque_delta,
    r0.receiver_resultant_delta,
    r0.structure_resultant_delta,
    r0.receiver_torque_delta,
    r0.structure_torque_delta,
  ]) requireCondition(vectorNorm(value) <= EPS, "ActionTally audit: H0/R0 null residual failed");

  for (const branchId of ACTION_TALLY_BRANCH_ORDER.slice(2)) {
    const branch = playback.branches[branchId];
    requireCondition(vectorNorm(add(branch.receiver_resultant_delta, branch.structure_resultant_delta)) <= EPS, `${branchId}: action-reaction closure failed`);
  }

  const channelCoverage: ActionTallyChannelCoverage[] = [
    { channel: "incident_action", physical_sign: "POSITIVE", public_projection: "AGGREGATE incident_m0 EXPORTED" },
    { channel: "straight_surviving_action", physical_sign: "POSITIVE", public_projection: "NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1" },
    { channel: "straight_deficit_action", physical_sign: "POSITIVE", public_projection: "NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1" },
    { channel: "redirected_action", physical_sign: "POSITIVE", public_projection: "NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1" },
    { channel: "escaped_action", physical_sign: "POSITIVE", public_projection: "NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1" },
    { channel: "trapped_action", physical_sign: "POSITIVE", public_projection: "NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1" },
    { channel: "unresolved_action", physical_sign: "POSITIVE", public_projection: "NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1" },
    { channel: "body_transfer", physical_sign: "POSITIVE", public_projection: "RESULTANT SUMMARY EXPORTED" },
    { channel: "body_torque", physical_sign: "POSITIVE", public_projection: "TORQUE SUMMARY EXPORTED" },
    { channel: "resolved_minus_homogenized", physical_sign: "SIGNED_DIAGNOSTIC", public_projection: "BODY DELTA SUMMARY EXPORTED" },
  ];

  return {
    status: "PACKET_AUDIT_PASS_WITH_SCOPED_CONTROLS",
    producer_commit: packet.producer_commit,
    packet_sha256: packet.packet_sha256,
    manifest_sha256: packet.manifest_sha256,
    verdict: packet.verdict,
    claim_ceiling: packet.claim_ceiling,
    secondary_verdict: EXPECTED_SECONDARY,
    public_projection_status: EXPECTED_PROJECTION,
    incident_packet_hash: incidentPacketHash,
    gates,
    metrics,
    branches,
    channel_coverage: channelCoverage,
  };
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value: number): string {
  if (value === 0) return "0";
  return Math.abs(value) < 1e-3 || Math.abs(value) >= 1e4 ? value.toExponential(3) : value.toFixed(6);
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function renderAudit(panel: HTMLElement, audit: ActionTallyAudit): void {
  panel.innerHTML = `
    <p class="eyebrow">G4 BRIDGE AUDIT</p>
    <h3>Common ActionTallyPackage · public coverage</h3>
    <div class="audit-status-row">
      <span class="audit-badge pass" data-testid="action-tally-audit-status">${audit.status}</span>
      <span class="audit-badge pass">G1–G8 PASS</span>
      <span class="audit-badge pass">G9/G10 SCOPED CONTROLS</span>
      <span class="audit-badge blocker">SI UNITS DEFERRED</span>
    </div>
    <p class="claim-note">The browser verifies the bounded summary only. Missing cell/channel arrays are not reconstructed. Dimensionless resultants are available per a common relational cycle; physical seconds and SI force units remain unbound.</p>
    <div class="audit-source-grid" data-testid="action-tally-audit-source">
      <div><span>Producer</span><code title="${escapeHtml(audit.producer_commit)}">${escapeHtml(shortHash(audit.producer_commit))}</code></div>
      <div><span>Source NPZ</span><code title="${escapeHtml(audit.packet_sha256)}">${escapeHtml(shortHash(audit.packet_sha256))}</code></div>
      <div><span>Manifest</span><code title="${escapeHtml(audit.manifest_sha256)}">${escapeHtml(shortHash(audit.manifest_sha256))}</code></div>
      <div><span>Incident packet</span><code title="${escapeHtml(audit.incident_packet_hash)}">${escapeHtml(shortHash(audit.incident_packet_hash))}</code></div>
    </div>
    <div class="audit-section-title">Gate and scope matrix</div>
    <div class="audit-gate-grid" data-testid="action-tally-gates">
      ${audit.gates.map(item => `<div><span>${escapeHtml(item.gate)}</span><strong>${escapeHtml(item.status)}</strong></div>`).join("")}
    </div>
    <div class="audit-section-title">Global residuals</div>
    <div class="audit-metric-grid" data-testid="action-tally-metrics">
      ${audit.metrics.map(item => `<div><span>${escapeHtml(item.metric)}</span><strong>${formatNumber(item.value)}</strong></div>`).join("")}
    </div>
    <div class="audit-section-title">H0 / R0–R3 comparison</div>
    <div class="audit-table-wrap"><table class="audit-table" data-testid="action-tally-branch-table"><thead><tr><th>Branch</th><th>Events</th><th>Incident M0</th><th>M0 residual</th><th>Deficit route</th><th>|R receiver|</th><th>|R structure|</th><th>|ΔR receiver|</th><th>|ΔR structure|</th><th>|τ structure|</th></tr></thead><tbody>
      ${audit.branches.map(row => `<tr><td>${escapeHtml(row.branch_id)}</td><td>${row.event_count}</td><td>${formatNumber(row.incident_m0)}</td><td>${formatNumber(row.m0_residual)}</td><td>${formatNumber(row.deficit_route_residual)}</td><td>${formatNumber(row.receiver_resultant_norm)}</td><td>${formatNumber(row.structure_resultant_norm)}</td><td>${formatNumber(row.receiver_delta_norm)}</td><td>${formatNumber(row.structure_delta_norm)}</td><td>${formatNumber(row.structure_torque_norm)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="audit-section-title">Common package channel coverage</div>
    <div class="audit-table-wrap"><table class="audit-table" data-testid="action-tally-channel-table"><thead><tr><th>Channel</th><th>Sign class</th><th>Public V1 projection</th></tr></thead><tbody>
      ${audit.channel_coverage.map(item => `<tr><td>${escapeHtml(item.channel)}</td><td>${escapeHtml(item.physical_sign)}</td><td>${escapeHtml(item.public_projection)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="claim-note"><strong>Verdict:</strong> ${escapeHtml(audit.verdict)}. <strong>Unit status:</strong> ${escapeHtml(audit.secondary_verdict)}. <strong>Projection:</strong> ${escapeHtml(audit.public_projection_status)}.</p>
  `;
}

export async function mountActionTallyAuditPanel(): Promise<void> {
  const anchor = document.querySelector<HTMLElement>(".action-tally-card");
  if (!anchor || document.querySelector("#action-tally-audit")) return;
  const panel = document.createElement("div");
  panel.id = "action-tally-audit";
  panel.className = "diagnostic-card action-tally-audit-card";
  panel.setAttribute("data-testid", "action-tally-audit");
  panel.innerHTML = `<p class="eyebrow">G4 BRIDGE AUDIT</p><h3>Common ActionTallyPackage · public coverage</h3><p data-testid="action-tally-audit-status">Loading governed audit…</p>`;
  anchor.insertAdjacentElement("afterend", panel);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}packets/${PACKET_FILE}`);
    if (!response.ok) throw new Error(`packet HTTP ${response.status}`);
    const packet = parseBrowserPacketV2(await response.json());
    renderAudit(panel, buildActionTallyAudit(packet));
  } catch (error) {
    panel.innerHTML = `<p class="eyebrow">G4 BRIDGE AUDIT</p><h3>Audit blocked</h3><p class="error-banner" data-testid="action-tally-audit-status">PACKET_AUDIT_BLOCKED · ${escapeHtml(error)}</p>`;
  }
}
