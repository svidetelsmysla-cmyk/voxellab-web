import { parseOperatorAuditPacket, type OperatorAuditPacket, type Vec3 } from "./packet";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing Operator Audit element: ${selector}`);
  return value;
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(5);
  return value.toFixed(6);
}

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function magnitude(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector: Vec3): Vec3 {
  const length = magnitude(vector);
  return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 0, 0];
}

function template(): string {
  return `
    <main class="operator-shell">
      <header class="operator-topbar">
        <div>
          <p class="eyebrow">VOXELLAB · GOVERNED READ-ONLY DIAGNOSTIC</p>
          <h1>Operator Audit <span>A1</span></h1>
          <p class="subtitle">Source-additive W=QN baseline versus project first-hit binary angular coverage</p>
        </div>
        <nav class="top-links">
          <span class="authority-chip">NOT SCIENTIFIC AUTHORITY</span>
          <code id="operator-commit"></code>
          <a href="/voxellab-web/">Scene Lab ↗</a>
          <a href="/voxellab-web/action-lab/">Action Transport Lab A0 ↗</a>
        </nav>
      </header>

      <section class="verdict-strip">
        <div><span>Main verdict</span><strong id="main-verdict">LOADING</strong></div>
        <div><span>Source audit</span><strong id="source-verdict">LOADING</strong></div>
        <div><span>Full reachable set</span><strong id="reachable-status">LOADING</strong></div>
        <div><span>SI binding</span><strong id="si-status">LOADING</strong></div>
      </section>

      <section class="operator-grid">
        <article class="card scene-card">
          <div class="section-head">
            <div><p class="eyebrow">MATCHED PAIR</p><h2>Same centres and amounts · radii reassigned</h2></div>
            <span id="standard-null" class="status-pill">standard null —</span>
          </div>
          <canvas id="matched-scene" width="760" height="360" data-testid="matched-scene"></canvas>
          <div class="scene-legend">
            <span><i class="receiver-dot"></i>receiver</span>
            <span><i class="branch-a-dot"></i>branch A radius</span>
            <span><i class="branch-b-dot"></i>branch B radius</span>
            <span>amount is identical in A/B</span>
          </div>
          <p class="claim-note">The circles are geometry only. Source amount is shown separately and is not inferred from radius.</p>
        </article>

        <aside class="card passport-card">
          <p class="eyebrow">OPERATOR PASSPORT</p>
          <h2>What each lane actually computes</h2>
          <div id="lane-list" class="lane-list" data-testid="lane-list"></div>
          <div class="firewall-box">
            <strong>Current boundary</strong>
            <span>Dimensionless operator delta available</span>
            <small>No selected routing law · no SI force · no Upor · no dipole · no validation.</small>
          </div>
        </aside>
      </section>

      <section class="analysis-grid">
        <article class="card chart-card">
          <div class="section-head"><div><p class="eyebrow">LANE DISCRIMINATOR</p><h2>A−B resultant norm</h2></div><span>same matched pair</span></div>
          <canvas id="lane-chart" width="680" height="330" data-testid="lane-chart"></canvas>
          <p class="claim-note"><strong>S0/S1 zero</strong> is the source-additive baseline. <strong>S2 nonzero</strong> is the additional first-hit operator delta, not validation of that operator.</p>
        </article>

        <article class="card chart-card">
          <div class="section-head"><div><p class="eyebrow">ANGULAR REFINEMENT</p><h2>First-hit |ΔD1|</h2></div><span>192 → 49,152 directions</span></div>
          <canvas id="refinement-chart" width="680" height="330" data-testid="refinement-chart"></canvas>
          <div id="fine-metrics" class="metric-grid"></div>
        </article>

        <article class="card chart-card wide-card">
          <div class="section-head"><div><p class="eyebrow">REACHABLE-SET OUTER BOUNDS</p><h2>Projection intervals retain zero</h2></div><span>not a selected constitutive kernel</span></div>
          <canvas id="interval-chart" width="1380" height="360" data-testid="interval-chart"></canvas>
          <p class="claim-note">These are outer bounds. Independent event choices do not prove that one common branch-blind physical operator realizes every point in the interval.</p>
        </article>
      </section>

      <section class="audit-grid">
        <article class="card">
          <p class="eyebrow">WEIGHTING AUDIT</p>
          <h2>First-hit S2 is binary angular coverage</h2>
          <div id="weighting-audit" class="binary-grid"></div>
        </article>
        <article class="card">
          <p class="eyebrow">SOURCE CLASS</p>
          <h2>Locked versus project-constructed</h2>
          <div class="source-columns">
            <div><strong>SOURCE-LOCKED</strong><ul id="source-locked"></ul></div>
            <div><strong>NOT SOURCE-LOCKED</strong><ul id="not-source-locked"></ul></div>
          </div>
        </article>
        <article class="card">
          <p class="eyebrow">PROVENANCE</p>
          <h2>Exact scientific packets</h2>
          <div id="provenance" class="provenance-grid"></div>
        </article>
      </section>

      <section class="card conclusion-card">
        <p class="eyebrow">LOGICAL DELTA</p>
        <h2>What has been established</h2>
        <div class="logic-flow">
          <div><strong>SOURCE ADDITIVE A−B</strong><span>= 0 exactly</span></div>
          <i>while</i>
          <div><strong>PROJECT FIRST-HIT A−B</strong><span>≠ 0</span></div>
          <i>therefore</i>
          <div class="highlight"><strong>CURRENT RESIDUAL</strong><span>is the delta introduced by the first-hit binary coverage operator</span></div>
        </div>
        <p>This classifies the operator. It does not establish a Viktor body-response law or that the direct deficit survives a positive outgoing redistribution.</p>
      </section>

      <footer>
        <span>Operator Audit A1 · governed read-only playback</span>
        <strong>NO FIRST-HIT PROMOTION · NO ROUTING LAW · NO SCALE · NO VALIDATION</strong>
      </footer>
    </main>
  `;
}

export class OperatorAuditApp {
  private packet: OperatorAuditPacket | null = null;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    required<HTMLElement>(root, "#operator-commit").textContent = APP_COMMIT.slice(0, 12);
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}packets/R6_OPERATOR_AUDIT_A1_BROWSER_PLAYBACK_V1.json`);
      if (!response.ok) throw new Error(`packet HTTP ${response.status}`);
      this.packet = parseOperatorAuditPacket(await response.json());
      this.render();
    } catch (error) {
      required<HTMLElement>(this.root, "#main-verdict").textContent = `PACKET BLOCKED · ${String(error)}`;
      this.root.classList.add("packet-blocked");
    }
  }

  private render(): void {
    const packet = this.packet;
    if (!packet) return;
    required<HTMLElement>(this.root, "#main-verdict").textContent = packet.main_verdict;
    required<HTMLElement>(this.root, "#source-verdict").textContent = packet.source_audit_verdict;
    required<HTMLElement>(this.root, "#reachable-status").textContent = packet.reachable_set.joint_source_constrained_zero_membership;
    required<HTMLElement>(this.root, "#si-status").textContent = packet.claim_ceiling.si_time_force_binding;
    required<HTMLElement>(this.root, "#standard-null").textContent = `standard isofield null = ${fmt(packet.matched_pair.standard_isofield_null)}`;
    this.renderScene(packet);
    this.renderLanes(packet);
    this.renderLaneChart(packet);
    this.renderRefinement(packet);
    this.renderIntervals(packet);
    this.renderWeighting(packet);
    this.renderSources(packet);
    this.renderProvenance(packet);
  }

  private renderScene(packet: OperatorAuditPacket): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#matched-scene");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = 310;
    const originX = 90;
    const originY = canvas.height / 2;
    ctx.fillStyle = "#06100e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#25443c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, originY);
    ctx.lineTo(canvas.width - 20, originY);
    ctx.stroke();

    const receiver = packet.matched_pair.receiver;
    ctx.fillStyle = "#f3df9c";
    ctx.beginPath();
    ctx.arc(originX + receiver[0] * scale, originY - receiver[1] * scale, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dcebe5";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("receiver", originX - 30, originY + 24);

    packet.matched_pair.centres.forEach((centre, index) => {
      const x = originX + centre[0] * scale;
      const y = originY - centre[1] * scale;
      const radiusA = packet.matched_pair.radii_a[index]! * scale;
      const radiusB = packet.matched_pair.radii_b[index]! * scale;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "#d99cff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radiusA, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = "#76f6c2";
      ctx.beginPath();
      ctx.arc(x, y, radiusB, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffb46d";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dcebe5";
      ctx.fillText(`body ${index + 1}`, x - 24, y - Math.max(radiusA, radiusB) - 9);
      ctx.fillStyle = "#8fa79e";
      ctx.fillText(`N=${packet.matched_pair.amounts[index]!.toFixed(2)}`, x - 24, y + Math.max(radiusA, radiusB) + 18);
    });

    const direction = normalize(packet.first_hit.delta_d1);
    const arrowStartX = originX;
    const arrowStartY = originY + 132;
    const arrowLength = 95;
    const endX = arrowStartX + direction[0] * arrowLength;
    const endY = arrowStartY - direction[1] * arrowLength;
    ctx.strokeStyle = "#ff805c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(arrowStartX, arrowStartY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.fillStyle = "#ff805c";
    ctx.fillText(`ΔD1 · |·|=${fmt(packet.first_hit.delta_d1_norm)}`, arrowStartX + 8, arrowStartY + 20);
  }

  private renderLanes(packet: OperatorAuditPacket): void {
    const holder = required<HTMLElement>(this.root, "#lane-list");
    holder.innerHTML = packet.lanes.map(lane => {
      const value = lane.a_minus_b_norm === null ? "NOT OPENED" : fmt(lane.a_minus_b_norm);
      return `<article class="lane-row ${lane.id.toLowerCase()}"><div><span>${escapeHtml(lane.id)}</span><strong>${escapeHtml(lane.name)}</strong></div><output>${escapeHtml(value)}</output><small>${escapeHtml(lane.source_class)} · ${escapeHtml(lane.status)}</small></article>`;
    }).join("");
  }

  private renderLaneChart(packet: OperatorAuditPacket): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#lane-chart");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#06100e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const zeroX = 175;
    const maxWidth = 420;
    const max = Math.max(...packet.lanes.map(lane => lane.a_minus_b_norm ?? 0), 1e-12);
    ctx.font = "12px ui-monospace, monospace";
    packet.lanes.forEach((lane, index) => {
      const y = 56 + index * 63;
      ctx.fillStyle = "#dcebe5";
      ctx.fillText(`${lane.id} ${lane.name}`, 18, y);
      ctx.strokeStyle = "#25443c";
      ctx.beginPath();
      ctx.moveTo(zeroX, y - 8);
      ctx.lineTo(zeroX + maxWidth, y - 8);
      ctx.stroke();
      if (lane.a_minus_b_norm === null) {
        ctx.fillStyle = "#718b82";
        ctx.fillText("HELD", zeroX + 8, y - 11);
      } else {
        const width = lane.a_minus_b_norm / max * maxWidth;
        ctx.fillStyle = lane.a_minus_b_norm === 0 ? "#76f6c2" : "#ff805c";
        ctx.fillRect(zeroX, y - 18, Math.max(2, width), 18);
        ctx.fillStyle = "#dcebe5";
        ctx.fillText(fmt(lane.a_minus_b_norm), zeroX + Math.max(8, width + 8), y - 8);
      }
    });
  }

  private renderRefinement(packet: OperatorAuditPacket): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#refinement-chart");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#06100e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const left = 62;
    const right = canvas.width - 34;
    const top = 30;
    const bottom = canvas.height - 48;
    const values = packet.refinement.map(row => row.delta_d1_norm);
    const min = Math.min(...values) * 0.94;
    const max = Math.max(...values) * 1.04;
    ctx.strokeStyle = "#25443c";
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.strokeStyle = "#d99cff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    packet.refinement.forEach((row, index) => {
      const x = left + index / (packet.refinement.length - 1) * (right - left);
      const y = bottom - (row.delta_d1_norm - min) / (max - min) * (bottom - top);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.font = "11px ui-monospace, monospace";
    packet.refinement.forEach((row, index) => {
      const x = left + index / (packet.refinement.length - 1) * (right - left);
      const y = bottom - (row.delta_d1_norm - min) / (max - min) * (bottom - top);
      ctx.fillStyle = "#d99cff";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8fa79e";
      ctx.fillText(String(row.directions), x - 18, bottom + 20);
      ctx.fillStyle = "#dcebe5";
      ctx.fillText(row.delta_d1_norm.toFixed(4), x - 22, y - 12);
    });
    required<HTMLElement>(this.root, "#fine-metrics").innerHTML = [
      ["ΔD0", fmt(packet.first_hit.delta_d0)],
      ["|ΔD1|", fmt(packet.first_hit.delta_d1_norm)],
      ["owner change", `${(100 * packet.first_hit.owner_change_fraction).toFixed(3)}%`],
      ["directions", packet.first_hit.direction_count.toLocaleString("en-US")],
    ].map(([name, value]) => `<div><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  }

  private renderIntervals(packet: OperatorAuditPacket): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#interval-chart");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#06100e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const allValues = packet.reachable_set.projection_rows.flatMap(row => [...row.universal, ...row.outward_hemisphere_outer]);
    const extent = Math.max(...allValues.map(Math.abs)) * 1.08;
    const centreX = canvas.width / 2;
    const scale = (canvas.width - 250) / (2 * extent);
    ctx.strokeStyle = "#ff805c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centreX, 24);
    ctx.lineTo(centreX, canvas.height - 25);
    ctx.stroke();
    ctx.fillStyle = "#ff805c";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText("ZERO", centreX + 7, 18);
    packet.reachable_set.projection_rows.forEach((row, index) => {
      const baseY = 72 + index * 92;
      const draw = (interval: [number, number], offset: number, color: string, label: string) => {
        const x0 = centreX + interval[0] * scale;
        const x1 = centreX + interval[1] * scale;
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x0, baseY + offset);
        ctx.lineTo(x1, baseY + offset);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x0, baseY + offset, 5, 0, Math.PI * 2);
        ctx.arc(x1, baseY + offset, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8fa79e";
        ctx.fillText(`${label} [${interval[0].toFixed(3)}, ${interval[1].toFixed(3)}]`, 18, baseY + offset + 4);
      };
      ctx.fillStyle = "#dcebe5";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText(row.axis, 18, baseY - 28);
      draw(row.universal, 0, "#d99cff", "universal");
      draw(row.outward_hemisphere_outer, 31, "#76f6c2", "outward outer");
    });
  }

  private renderWeighting(packet: OperatorAuditPacket): void {
    const fields: Array<[string, boolean]> = [
      ["source amount", packet.first_hit.consumes_source_amount],
      ["source distance", packet.first_hit.consumes_source_distance],
      ["chord length", packet.first_hit.consumes_chord_length],
      ["density", packet.first_hit.consumes_density],
    ];
    const consumed = packet.first_hit.consumes.map(value => `<li>${escapeHtml(value)}</li>`).join("");
    required<HTMLElement>(this.root, "#weighting-audit").innerHTML = `
      <div><strong>CONSUMES</strong><ul>${consumed}</ul></div>
      <div><strong>DOES NOT CONSUME</strong>${fields.map(([name, value]) => `<p><span>${escapeHtml(name)}</span><b>${value ? "YES" : "NO"}</b></p>`).join("")}</div>
    `;
  }

  private renderSources(packet: OperatorAuditPacket): void {
    required<HTMLElement>(this.root, "#source-locked").innerHTML = packet.source_classes.source_locked.map(value => `<li>${escapeHtml(value)}</li>`).join("");
    required<HTMLElement>(this.root, "#not-source-locked").innerHTML = packet.source_classes.not_source_locked.map(value => `<li>${escapeHtml(value)}</li>`).join("");
  }

  private renderProvenance(packet: OperatorAuditPacket): void {
    const source = packet.scientific_sources.source_additive_vs_first_hit;
    const geometry = packet.scientific_sources.event_geometry_reachable_set;
    const audit = packet.scientific_sources.source_audit;
    const rows = [
      ["S0/S1/S2 head", shortHash(source.head)],
      ["S0/S1/S2 workflow", String(source.workflow_run)],
      ["S0/S1/S2 artifact", shortHash(source.artifact_sha256)],
      ["event geometry head", shortHash(geometry.head)],
      ["event geometry workflow", String(geometry.workflow_run)],
      ["event geometry artifact", shortHash(geometry.artifact_sha256)],
      ["source audit", shortHash(audit.report_commit)],
      ["source decision", shortHash(audit.decision_commit)],
      ["context", shortHash(audit.context_commit)],
    ];
    required<HTMLElement>(this.root, "#provenance").innerHTML = rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><code>${escapeHtml(value)}</code></div>`).join("");
  }
}
