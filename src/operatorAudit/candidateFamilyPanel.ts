import { parseCandidateFamilyPacket, type CandidateFamilyPacket, type Vec3 } from "./candidateFamilyPacket";

function required<T extends Element>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing candidate-family element: ${selector}`);
  return value;
}

function fmt(value: number): string {
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(5);
  return value.toFixed(6);
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function vectorText(vector: Vec3): string {
  return `[${vector.map(fmt).join(", ")}]`;
}

function renderCandidateChart(canvas: HTMLCanvasElement, packet: CandidateFamilyPacket): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#06100e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const left = 210;
  const maximum = Math.max(...packet.candidates.map(candidate => candidate.resultant_norm));
  ctx.font = "11px ui-monospace, monospace";
  packet.candidates.forEach((candidate, index) => {
    const y = 48 + index * 54;
    const width = candidate.resultant_norm / maximum * (canvas.width - left - 95);
    ctx.fillStyle = "#dcebe5";
    ctx.fillText(candidate.candidate_id.replace(/_/g, " "), 12, y);
    ctx.strokeStyle = "#25443c";
    ctx.beginPath();
    ctx.moveTo(left, y - 10);
    ctx.lineTo(canvas.width - 35, y - 10);
    ctx.stroke();
    ctx.fillStyle = index === 0 ? "#76f6c2" : "#ff805c";
    ctx.fillRect(left, y - 20, Math.max(2, width), 18);
    ctx.fillStyle = "#dcebe5";
    ctx.fillText(fmt(candidate.resultant_norm), left + Math.max(8, width + 8), y - 10);
  });
}

function renderPanel(packet: CandidateFamilyPacket): HTMLElement {
  const section = document.createElement("section");
  section.className = "candidate-family-section card";
  section.dataset.testid = "candidate-family-panel";
  section.innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">BODY RESPONSE CONTROLS · A1.1</p><h2>Minimal positive conservative candidate family</h2></div>
      <span>${escapeHtml(packet.candidate_source_class)}</span>
    </div>
    <div class="candidate-verdicts">
      <div><span>Main</span><strong>${escapeHtml(packet.main_verdict)}</strong></div>
      <div><span>Secondary</span><strong>${escapeHtml(packet.secondary_verdict)}</strong></div>
      <div><span>Scientific residual</span><strong>NOT ESTABLISHED</strong></div>
    </div>
    <div class="candidate-layout">
      <div>
        <canvas id="candidate-family-chart" width="760" height="330" data-testid="candidate-family-chart"></canvas>
        <p class="claim-note"><strong>C0 reaches zero.</strong> Therefore positivity, conservation, locality, covariance and branch blindness do not force a nonzero full response.</p>
      </div>
      <div class="candidate-table-wrap">
        <table class="candidate-table" data-testid="candidate-family-table">
          <thead><tr><th>ID</th><th>Resultant</th><th>Torque</th><th>Role</th></tr></thead>
          <tbody>${packet.candidates.map(candidate => `
            <tr>
              <td>${escapeHtml(candidate.candidate_id)}</td>
              <td title="${escapeHtml(vectorText(candidate.resultant))}">${fmt(candidate.resultant_norm)}</td>
              <td title="${escapeHtml(vectorText(candidate.torque))}">${fmt(candidate.torque_norm)}</td>
              <td>${escapeHtml(candidate.role)}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="hull-grid">
      <div class="hull-card zero"><span>ALL C0–C4 · RESULTANT</span><strong>${fmt(packet.hulls.all_resultant.minimum_distance)}</strong><small>ZERO INCLUDED</small></div>
      <div class="hull-card zero"><span>ALL C0–C4 · RESULTANT+TORQUE</span><strong>${fmt(packet.hulls.all_joint.minimum_distance)}</strong><small>ZERO INCLUDED</small></div>
      <div class="hull-card nonzero"><span>NONFORWARD C1–C4 · RESULTANT</span><strong>${fmt(packet.hulls.nonforward_resultant.minimum_distance)}</strong><small>ZERO EXCLUDED IN THIS FAMILY</small></div>
      <div class="hull-card nonzero"><span>NONFORWARD C1–C4 · RESULTANT+TORQUE</span><strong>${fmt(packet.hulls.nonforward_joint.minimum_distance)}</strong><small>ZERO EXCLUDED IN THIS FAMILY</small></div>
    </div>
    <div class="candidate-boundary">
      <strong>Interpretation boundary</strong>
      <p>${escapeHtml(packet.logical_delta.interpretation)}</p>
      <p>The C1–C4 exclusion is family-specific. It is not a theorem about every nonforward positive law and does not promote any candidate to Viktor's model.</p>
    </div>
    <div class="candidate-provenance">
      <span>head <code>${escapeHtml(packet.scientific_head)}</code></span>
      <span>workflow <code>${packet.workflow_run}</code></span>
      <span>artifact <code>${escapeHtml(packet.artifact_sha256)}</code></span>
    </div>
  `;
  return section;
}

export async function mountCandidateFamilyPanel(): Promise<void> {
  const anchor = document.querySelector<HTMLElement>(".conclusion-card");
  if (!anchor || document.querySelector("[data-testid='candidate-family-panel']")) return;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}packets/R6_BODY_RESPONSE_CANDIDATE_FAMILY_A1_1_BROWSER_PLAYBACK_V1.json`);
    if (!response.ok) throw new Error(`packet HTTP ${response.status}`);
    const packet = parseCandidateFamilyPacket(await response.json());
    const panel = renderPanel(packet);
    anchor.insertAdjacentElement("beforebegin", panel);
    renderCandidateChart(required<HTMLCanvasElement>("#candidate-family-chart"), packet);
  } catch (error) {
    const panel = document.createElement("section");
    panel.className = "candidate-family-section card packet-error";
    panel.dataset.testid = "candidate-family-panel";
    panel.textContent = `Candidate family playback blocked: ${String(error)}`;
    anchor.insertAdjacentElement("beforebegin", panel);
  }
}
