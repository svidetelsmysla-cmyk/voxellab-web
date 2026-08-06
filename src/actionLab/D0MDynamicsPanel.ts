const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";
const PACKET_URL = `${import.meta.env.BASE_URL}packets/R13_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1.json`;

type LevelId = "N24" | "N48" | "N96" | "N192";
type Milestone = 1.1 | 1.25 | 1.5;

interface Multipoles {
  l1: number;
  l2: number;
  l3: number;
  l4: number;
}

interface Snapshot {
  milestone: Milestone;
  step: number;
  tau: number;
  expansion: number;
  overshoot: number;
  rRms: number;
  eigenvalues: [number, number, number];
  anisotropy: number;
  anisotropyDrift: number;
  homologousRate: number;
  homologyResidual: number;
  tangentialKineticFraction: number;
  outwardAmountFraction: number;
  multipoles: Multipoles;
  p2GrowthRatio: number;
  p4GrowthRatio: number;
  minimumPairRatio: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  relativeEnergyDrift: number;
  centreOfAmountDriftOverInitialRms: number;
  normalizedLinearMomentumResidual: number;
  normalizedAngularMomentumResidual: number;
}

interface LevelPacket {
  id: LevelId;
  count: number;
  shellCount: number;
  dt: number;
  initial: {
    rRms: number;
    minimumPairDistance: number;
    anisotropy: number;
    multipoles: Multipoles;
    potentialEnergy: number;
  };
  run: {
    reachedAllMilestones: boolean;
    finite: boolean;
    singularEventCount: number;
    minimumPairRatioObserved: number;
    maximumCentreDriftOverInitialRms: number;
    maximumLinearMomentumResidual: number;
    maximumAngularMomentumResidual: number;
  };
  milestones: Snapshot[];
}

interface Gate {
  id: string;
  label: string;
  value: number | boolean;
  threshold: number | boolean;
  pass: boolean;
}

interface Covariance {
  control: "ROTATION" | "PERMUTATION";
  maximumPositionStateRms: number;
  maximumVelocityStateRms: number;
  maximumStateRms: number;
  maximumScalarDelta: number;
  comparedMilestones: number;
}

interface TimeRefinement {
  level: "N96";
  coarseDt: number;
  mediumDt: number;
  fineDt: number;
  anisotropyDeltaMediumFine: number;
  tangentialDeltaMediumFine: number;
  homologyDeltaMediumFine: number;
  energyDriftCoarse: number;
  energyDriftMedium: number;
  energyDriftFine: number;
}

interface D0MPacket {
  schema: string;
  sourceClass: string;
  publicRole: string;
  producer: {
    repository: string;
    branch: string;
    sourceCommit: string;
    projectionCommit: string;
    preregistration: string;
  };
  verdict: string;
  d0cStatus: string;
  claimCeiling: string;
  operatorAudit: Record<string, boolean>;
  levels: LevelPacket[];
  gates: Gate[];
  rotationCovariance: Covariance;
  permutationCovariance: Covariance;
  timeRefinement: TimeRefinement;
  receipt: {
    workflowRunId: number;
    jobId: number;
    artifactId: number;
    fullReceiptSha256: string;
    summarySha256: string;
    artifactZipSha256: string;
    ci: string;
  };
  interpretation: {
    size: string;
    shape: string;
    notEstablished: string[];
  };
  firewalls: string[];
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing D0M element: ${selector}`);
  return value;
}

function format(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e4) return value.toExponential(5);
  return value.toFixed(7);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function template(): string {
  return `
    <section class="d0m-panel card" data-testid="d0m-panel">
      <div class="section-head d0m-head">
        <div>
          <p class="eyebrow">D0M · INDEPENDENT MICROBODY DYNAMICS PLAYBACK</p>
          <h2>Свободное расширение: размер меняется, форму проверяем отдельно</h2>
          <p>Read-only воспроизведение пререгистрированного direct-pair опыта. Браузер не пересчитывает движение. Каждое микротело имело независимые положение и скорость; жёстких внутренних offsets, damping, softening, контакта и упора не было.</p>
        </div>
        <span id="d0m-status" class="audit-badge">LOADING D0M</span>
      </div>

      <div class="d0m-controls">
        <label>Refinement level
          <select id="d0m-level"></select>
        </label>
        <label>Expansion milestone
          <select id="d0m-milestone">
            <option value="1.1">Rrms / Rrms₀ = 1.10</option>
            <option value="1.25">Rrms / Rrms₀ = 1.25</option>
            <option value="1.5" selected>Rrms / Rrms₀ = 1.50</option>
          </select>
        </label>
        <button id="d0m-export">DOWNLOAD GOVERNED PACKET</button>
      </div>

      <div class="d0m-size-shape-grid">
        <article class="d0m-card">
          <div class="section-head"><div><p class="eyebrow">SIZE</p><h2>Общий радиальный масштаб</h2></div><span id="d0m-size-label"></span></div>
          <canvas id="d0m-size-canvas" width="720" height="390" data-testid="d0m-size-canvas"></canvas>
          <p class="d0m-note">Рост Rrms ожидаем для свободной отталкивающейся группы. Он не является потерей сферической формы и не является равновесием.</p>
        </article>

        <article class="d0m-card">
          <div class="section-head"><div><p class="eyebrow">NORMALIZED SHAPE</p><h2>A, T и H после деления на Rrms</h2></div><span>lower is more radial/spherical</span></div>
          <canvas id="d0m-shape-canvas" width="720" height="390" data-testid="d0m-shape-canvas"></canvas>
          <div class="d0m-legend"><span class="d0m-a-line">anisotropy A</span><span class="d0m-t-line">tangential T</span><span class="d0m-h-line">homology residual H</span></div>
        </article>
      </div>

      <div class="d0m-proxy-metrics-grid">
        <article class="d0m-card">
          <div class="section-head"><div><p class="eyebrow">SHAPE-TENSOR PROXY</p><h2>Не контур, а главные оси второго момента</h2></div><span id="d0m-proxy-label"></span></div>
          <canvas id="d0m-proxy-canvas" width="720" height="480" data-testid="d0m-proxy-canvas"></canvas>
          <p class="d0m-note">Эллипсы показывают только отношения собственных значений тензора формы. Они не реконструируют поверхность и не являются рассчитанным контуром сгустка.</p>
        </article>

        <article class="d0m-card d0m-ledger" data-testid="d0m-ledger">
          <div class="section-head"><div><p class="eyebrow">SELECTED SNAPSHOT</p><h2 id="d0m-selected-title"></h2></div></div>
          <dl>
            <div><dt>τ / completed step</dt><dd id="d0m-tau"></dd></div>
            <div><dt>expansion / overshoot</dt><dd id="d0m-expansion"></dd></div>
            <div><dt>eigenvalues λ₁,λ₂,λ₃</dt><dd id="d0m-eigenvalues"></dd></div>
            <div><dt>anisotropy / drift</dt><dd id="d0m-anisotropy"></dd></div>
            <div><dt>tangential fraction T</dt><dd id="d0m-tangential"></dd></div>
            <div><dt>homology residual H</dt><dd id="d0m-homology"></dd></div>
            <div><dt>outward amount fraction</dt><dd id="d0m-outward"></dd></div>
            <div><dt>P2 / P4 growth ratios</dt><dd id="d0m-multipole-growth"></dd></div>
            <div><dt>minimum pair ratio</dt><dd id="d0m-pair-ratio"></dd></div>
            <div><dt>relative energy drift</dt><dd id="d0m-energy"></dd></div>
            <div><dt>COM / momentum / angular</dt><dd id="d0m-conservation"></dd></div>
          </dl>
        </article>
      </div>

      <article class="d0m-card d0m-refinement-card">
        <div class="section-head"><div><p class="eyebrow">N REFINEMENT AT EXPANSION 1.50</p><h2>Упаковочный отпечаток уменьшается</h2></div></div>
        <canvas id="d0m-refinement-canvas" width="1080" height="420" data-testid="d0m-refinement-canvas"></canvas>
        <table data-testid="d0m-refinement-table">
          <thead><tr><th>level</th><th>initial A</th><th>final A</th><th>ΔA</th><th>T</th><th>H</th><th>energy drift</th></tr></thead>
          <tbody id="d0m-refinement-body"></tbody>
        </table>
      </article>

      <div class="d0m-audit-grid">
        <article class="d0m-card" data-testid="d0m-gates">
          <div class="section-head"><div><p class="eyebrow">G01–G18</p><h2>Frozen gates</h2></div><span>18 / 18 preregistered</span></div>
          <table><thead><tr><th>gate</th><th>metric</th><th>value</th><th>threshold</th><th>status</th></tr></thead><tbody id="d0m-gates-body"></tbody></table>
        </article>

        <article class="d0m-card" data-testid="d0m-operator-audit">
          <div class="section-head"><div><p class="eyebrow">OPERATOR FIREWALL</p><h2>Что было и чего не было</h2></div></div>
          <table><thead><tr><th>ingredient</th><th>value</th><th>meaning</th></tr></thead><tbody id="d0m-operator-body"></tbody></table>
        </article>
      </div>

      <div class="d0m-audit-grid">
        <article class="d0m-card" data-testid="d0m-covariance">
          <div class="section-head"><div><p class="eyebrow">COVARIANCE</p><h2>Rotation and particle order</h2></div></div>
          <table><thead><tr><th>control</th><th>position RMS</th><th>velocity RMS</th><th>scalar Δ</th></tr></thead><tbody id="d0m-covariance-body"></tbody></table>
        </article>
        <article class="d0m-card" data-testid="d0m-time-refinement">
          <div class="section-head"><div><p class="eyebrow">TIME REFINEMENT</p><h2>N96 · Δτ 0.004 → 0.001</h2></div></div>
          <dl>
            <div><dt>ΔA medium/fine</dt><dd id="d0m-dt-a"></dd></div>
            <div><dt>ΔT medium/fine</dt><dd id="d0m-dt-t"></dd></div>
            <div><dt>ΔH medium/fine</dt><dd id="d0m-dt-h"></dd></div>
            <div><dt>energy coarse/medium/fine</dt><dd id="d0m-dt-energy"></dd></div>
          </dl>
        </article>
      </div>

      <article class="d0m-card d0m-provenance" data-testid="d0m-provenance">
        <div class="section-head"><div><p class="eyebrow">PROVENANCE</p><h2>Read-only governed projection</h2></div></div>
        <dl>
          <div><dt>source producer</dt><dd id="d0m-source-commit"></dd></div>
          <div><dt>full receipt SHA256</dt><dd id="d0m-receipt-hash"></dd></div>
          <div><dt>artifact / workflow</dt><dd id="d0m-artifact"></dd></div>
          <div><dt>claim ceiling</dt><dd id="d0m-claim-ceiling"></dd></div>
        </dl>
      </article>

      <div id="d0m-conclusion" class="d0m-conclusion" data-testid="d0m-conclusion"></div>
      <code class="closure-commit">interface commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

const OPERATOR_LABELS: Record<string, string> = {
  directPositiveCentralPair: "direct positive central pair",
  pairedActionReaction: "paired action–reaction",
  independentStatePerMicrobody: "independent state per microbody",
  damping: "damping",
  softening: "softening",
  distanceCutoff: "distance cutoff",
  forceCap: "force cap",
  velocityClipping: "velocity clipping",
  contact: "contact reaction",
  upor: "Upor",
  radialShellRestoration: "radial-shell restoration",
  neighbourRestLengths: "neighbour rest lengths",
  shapeMatching: "shape matching",
  backgroundScreening: "background screening in motion",
  redirection: "redirection in motion",
  physicalSeconds: "physical seconds",
};

function isPositiveIngredient(key: string): boolean {
  return key === "directPositiveCentralPair"
    || key === "pairedActionReaction"
    || key === "independentStatePerMicrobody";
}

export class D0MDynamicsPanel {
  private packet: D0MPacket | null = null;
  private selectedLevel: LevelId = "N192";
  private selectedMilestone: Milestone = 1.5;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.bind();
    void this.load();
  }

  private bind(): void {
    required<HTMLSelectElement>(this.root, "#d0m-level").addEventListener("change", (event) => {
      this.selectedLevel = (event.target as HTMLSelectElement).value as LevelId;
      this.renderSelection();
    });
    required<HTMLSelectElement>(this.root, "#d0m-milestone").addEventListener("change", (event) => {
      this.selectedMilestone = Number((event.target as HTMLSelectElement).value) as Milestone;
      this.renderSelection();
    });
    required<HTMLButtonElement>(this.root, "#d0m-export").addEventListener("click", () => this.downloadPacket());
  }

  private async load(): Promise<void> {
    try {
      const response = await fetch(PACKET_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`D0M packet fetch failed: ${response.status}`);
      this.packet = await response.json() as D0MPacket;
      this.validatePacket(this.packet);
      this.renderAll();
    } catch (error) {
      const status = required<HTMLElement>(this.root, "#d0m-status");
      status.textContent = "D0M PACKET BLOCKER";
      status.className = "audit-badge fail";
      required<HTMLElement>(this.root, "#d0m-conclusion").textContent = error instanceof Error ? error.message : String(error);
    }
  }

  private validatePacket(packet: D0MPacket): void {
    if (packet.schema !== "VOXELLAB_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1") throw new Error("Unexpected D0M schema");
    if (packet.publicRole !== "READ_ONLY_GOVERNED_PLAYBACK_NO_BROWSER_PHYSICS_RECOMPUTATION") throw new Error("D0M public role mismatch");
    if (packet.levels.length !== 4) throw new Error("D0M level count mismatch");
    if (packet.gates.length !== 18 || packet.gates.some((gate) => !gate.pass)) throw new Error("D0M gate matrix is not 18/18 PASS");
    if (packet.verdict !== "D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS") throw new Error("Unexpected D0M verdict");
  }

  private renderAll(): void {
    const packet = this.requirePacket();
    const status = required<HTMLElement>(this.root, "#d0m-status");
    status.textContent = "D0M NORMALIZED SHAPE PASS";
    status.className = "audit-badge pass";

    const levelSelect = required<HTMLSelectElement>(this.root, "#d0m-level");
    levelSelect.innerHTML = packet.levels.map((level) => `<option value="${level.id}" ${level.id === this.selectedLevel ? "selected" : ""}>${level.id} · ${level.count} independent states</option>`).join("");

    this.renderSelection();
    this.renderRefinement();
    this.renderGates();
    this.renderOperatorAudit();
    this.renderCovariance();
    this.renderTimeRefinement();
    this.renderProvenance();

    required<HTMLElement>(this.root, "#d0m-conclusion").innerHTML = `
      <strong>${escapeHtml(packet.verdict)}</strong>
      <p>Изолированная группа расширилась до Rrms/Rrms₀=1.50 без добавленного удержания. После деления на текущий Rrms анизотропия, тангенциальная доля и нехомологичный остаток уменьшались с refinement. Это открывает D0C как отдельный direct-pair encounter gate.</p>
      <small>Не установлены: самоподдерживающийся сгусток, полный оператор Виктора, фон/перенаправление в движении, контакт, упор, физическое время/сила, масштаб или валидация.</small>
    `;
  }

  private requirePacket(): D0MPacket {
    if (!this.packet) throw new Error("D0M packet is not loaded");
    return this.packet;
  }

  private selected(): { level: LevelPacket; snapshot: Snapshot } {
    const packet = this.requirePacket();
    const level = packet.levels.find((entry) => entry.id === this.selectedLevel);
    if (!level) throw new Error(`Unknown D0M level ${this.selectedLevel}`);
    const snapshot = level.milestones.find((entry) => entry.milestone === this.selectedMilestone);
    if (!snapshot) throw new Error(`Missing D0M milestone ${this.selectedMilestone}`);
    return { level, snapshot };
  }

  private renderSelection(): void {
    if (!this.packet) return;
    const { level, snapshot } = this.selected();
    required<HTMLElement>(this.root, "#d0m-size-label").textContent = `${level.id} · Δτ=${level.dt}`;
    required<HTMLElement>(this.root, "#d0m-proxy-label").textContent = `${level.id} · expansion ${snapshot.expansion.toFixed(4)}`;
    required<HTMLElement>(this.root, "#d0m-selected-title").textContent = `${level.id} at registered ${snapshot.milestone.toFixed(2)} milestone`;
    required<HTMLElement>(this.root, "#d0m-tau").textContent = `${format(snapshot.tau)} / ${snapshot.step}`;
    required<HTMLElement>(this.root, "#d0m-expansion").textContent = `${format(snapshot.expansion)} / +${format(snapshot.overshoot)}`;
    required<HTMLElement>(this.root, "#d0m-eigenvalues").textContent = snapshot.eigenvalues.map(format).join(" · ");
    required<HTMLElement>(this.root, "#d0m-anisotropy").textContent = `${format(snapshot.anisotropy)} / ${format(snapshot.anisotropyDrift)}`;
    required<HTMLElement>(this.root, "#d0m-tangential").textContent = format(snapshot.tangentialKineticFraction);
    required<HTMLElement>(this.root, "#d0m-homology").textContent = format(snapshot.homologyResidual);
    required<HTMLElement>(this.root, "#d0m-outward").textContent = format(Math.min(1, snapshot.outwardAmountFraction));
    required<HTMLElement>(this.root, "#d0m-multipole-growth").textContent = `${format(snapshot.p2GrowthRatio)} / ${format(snapshot.p4GrowthRatio)}`;
    required<HTMLElement>(this.root, "#d0m-pair-ratio").textContent = format(snapshot.minimumPairRatio);
    required<HTMLElement>(this.root, "#d0m-energy").textContent = format(snapshot.relativeEnergyDrift);
    required<HTMLElement>(this.root, "#d0m-conservation").textContent = `${format(snapshot.centreOfAmountDriftOverInitialRms)} / ${format(snapshot.normalizedLinearMomentumResidual)} / ${format(snapshot.normalizedAngularMomentumResidual)}`;
    this.drawSize(level);
    this.drawShape(level);
    this.drawProxy(snapshot);
  }

  private drawAxes(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, left: number, right: number, top: number, bottom: number): void {
    context.strokeStyle = "rgba(255,255,255,.13)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, canvas.height - bottom);
    context.lineTo(canvas.width - right, canvas.height - bottom);
    context.stroke();
  }

  private drawSize(level: LevelPacket): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#d0m-size-canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("D0M size canvas unavailable");
    const left = 58, right = 22, top = 24, bottom = 48;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    const maxTau = Math.max(...level.milestones.map((snapshot) => snapshot.tau)) * 1.08;
    const xOf = (tau: number) => left + tau / maxTau * width;
    const yOf = (expansion: number) => top + (1.55 - expansion) / 0.55 * height;
    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    this.drawAxes(context, canvas, left, right, top, bottom);
    context.font = "12px ui-monospace, monospace";
    context.fillStyle = "rgba(228,238,232,.74)";
    for (const value of [1, 1.1, 1.25, 1.5]) {
      const y = yOf(value);
      context.strokeStyle = "rgba(255,255,255,.08)";
      context.beginPath(); context.moveTo(left, y); context.lineTo(canvas.width - right, y); context.stroke();
      context.fillText(value.toFixed(2), 12, y + 4);
    }
    const points = [{ tau: 0, expansion: 1 }, ...level.milestones.map((snapshot) => ({ tau: snapshot.tau, expansion: snapshot.expansion }))];
    context.strokeStyle = "#77e1b8";
    context.lineWidth = 3;
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(xOf(point.tau), yOf(point.expansion)); else context.lineTo(xOf(point.tau), yOf(point.expansion));
    });
    context.stroke();
    points.forEach((point) => {
      context.fillStyle = "#77e1b8";
      context.beginPath(); context.arc(xOf(point.tau), yOf(point.expansion), 5, 0, 2 * Math.PI); context.fill();
      context.fillStyle = "rgba(235,243,239,.82)";
      context.fillText(point.tau.toFixed(3), xOf(point.tau) - 18, canvas.height - 18);
    });
  }

  private drawShape(level: LevelPacket): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#d0m-shape-canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("D0M shape canvas unavailable");
    const left = 58, right = 22, top = 24, bottom = 48;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    const seriesMaximum = Math.max(
      level.initial.anisotropy,
      ...level.milestones.flatMap((snapshot) => [snapshot.anisotropy, snapshot.tangentialKineticFraction, snapshot.homologyResidual]),
      0.02,
    ) * 1.12;
    const xOf = (expansion: number) => left + (expansion - 1) / 0.5 * width;
    const yOf = (value: number) => top + (seriesMaximum - value) / seriesMaximum * height;
    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    this.drawAxes(context, canvas, left, right, top, bottom);
    context.font = "12px ui-monospace, monospace";
    context.fillStyle = "rgba(228,238,232,.74)";
    for (const expansion of [1, 1.1, 1.25, 1.5]) context.fillText(expansion.toFixed(2), xOf(expansion) - 14, canvas.height - 18);

    const draw = (values: Array<{ expansion: number; value: number }>, stroke: string, dash: number[] = []) => {
      context.strokeStyle = stroke;
      context.lineWidth = 3;
      context.setLineDash(dash);
      context.beginPath();
      values.forEach((point, index) => {
        if (index === 0) context.moveTo(xOf(point.expansion), yOf(point.value)); else context.lineTo(xOf(point.expansion), yOf(point.value));
      });
      context.stroke();
      context.setLineDash([]);
      values.forEach((point) => {
        context.fillStyle = stroke;
        context.beginPath(); context.arc(xOf(point.expansion), yOf(point.value), 4, 0, 2 * Math.PI); context.fill();
      });
    };

    draw([{ expansion: 1, value: level.initial.anisotropy }, ...level.milestones.map((snapshot) => ({ expansion: snapshot.expansion, value: snapshot.anisotropy }))], "#f2d573");
    draw([{ expansion: 1, value: 0 }, ...level.milestones.map((snapshot) => ({ expansion: snapshot.expansion, value: snapshot.tangentialKineticFraction }))], "#79b8ff", [8, 5]);
    draw([{ expansion: 1, value: 0 }, ...level.milestones.map((snapshot) => ({ expansion: snapshot.expansion, value: snapshot.homologyResidual }))], "#e59bff", [3, 4]);
  }

  private drawProxy(snapshot: Snapshot): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#d0m-proxy-canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("D0M proxy canvas unavailable");
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const referenceRadius = 150;
    const axes = snapshot.eigenvalues.map((value) => Math.sqrt(value / (1 / 3)) * referenceRadius);
    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(245,231,164,.42)";
    context.lineWidth = 2;
    context.setLineDash([8, 7]);
    context.beginPath(); context.arc(cx, cy, referenceRadius, 0, 2 * Math.PI); context.stroke();
    context.setLineDash([]);
    context.fillStyle = "rgba(112,226,184,.17)";
    context.strokeStyle = "#70e2b8";
    context.lineWidth = 3;
    context.beginPath(); context.ellipse(cx, cy, axes[0]!, axes[1]!, -0.22, 0, 2 * Math.PI); context.fill(); context.stroke();
    context.strokeStyle = "rgba(124,183,255,.86)";
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx + axes[2]! * 0.78, cy - axes[2]! * 0.48);
    context.stroke();
    context.fillStyle = "rgba(235,243,239,.84)";
    context.font = "13px ui-monospace, monospace";
    context.fillText(`λ = ${snapshot.eigenvalues.map((value) => value.toFixed(6)).join(" / ")}`, 20, 28);
    context.fillText("dashed = isotropic second-moment reference", 20, canvas.height - 22);
  }

  private renderRefinement(): void {
    const packet = this.requirePacket();
    const rows = packet.levels.map((level) => ({ level, final: level.milestones.find((snapshot) => snapshot.milestone === 1.5)! }));
    required<HTMLElement>(this.root, "#d0m-refinement-body").innerHTML = rows.map(({ level, final }) => `
      <tr><td>${level.id}</td><td>${format(level.initial.anisotropy)}</td><td>${format(final.anisotropy)}</td><td>${format(final.anisotropyDrift)}</td><td>${format(final.tangentialKineticFraction)}</td><td>${format(final.homologyResidual)}</td><td>${format(final.relativeEnergyDrift)}</td></tr>
    `).join("");

    const canvas = required<HTMLCanvasElement>(this.root, "#d0m-refinement-canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("D0M refinement canvas unavailable");
    const left = 64, right = 24, top = 24, bottom = 52;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    const xOf = (index: number) => left + index / (rows.length - 1) * width;
    const yOf = (value: number) => top + (0.15 - Math.min(0.15, value)) / 0.15 * height;
    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    this.drawAxes(context, canvas, left, right, top, bottom);
    context.font = "12px ui-monospace, monospace";
    context.fillStyle = "rgba(228,238,232,.74)";
    rows.forEach(({ level }, index) => context.fillText(level.id, xOf(index) - 14, canvas.height - 18));
    const draw = (selector: (row: typeof rows[number]) => number, stroke: string, dash: number[] = []) => {
      context.strokeStyle = stroke;
      context.lineWidth = 3;
      context.setLineDash(dash);
      context.beginPath();
      rows.forEach((row, index) => {
        if (index === 0) context.moveTo(xOf(index), yOf(selector(row))); else context.lineTo(xOf(index), yOf(selector(row)));
      });
      context.stroke();
      context.setLineDash([]);
      rows.forEach((row, index) => {
        context.fillStyle = stroke;
        context.beginPath(); context.arc(xOf(index), yOf(selector(row)), 4, 0, 2 * Math.PI); context.fill();
      });
    };
    draw((row) => row.final.anisotropyDrift, "#f2d573");
    draw((row) => row.final.tangentialKineticFraction, "#79b8ff", [8, 5]);
    draw((row) => row.final.homologyResidual, "#e59bff", [3, 4]);
  }

  private renderGates(): void {
    const packet = this.requirePacket();
    required<HTMLElement>(this.root, "#d0m-gates-body").innerHTML = packet.gates.map((gate) => `
      <tr><td>${gate.id}</td><td>${escapeHtml(gate.label)}</td><td>${format(gate.value)}</td><td>${format(gate.threshold)}</td><td class="${gate.pass ? "pass-text" : "fail-text"}">${gate.pass ? "PASS" : "FAIL"}</td></tr>
    `).join("");
  }

  private renderOperatorAudit(): void {
    const packet = this.requirePacket();
    required<HTMLElement>(this.root, "#d0m-operator-body").innerHTML = Object.entries(packet.operatorAudit).map(([key, value]) => {
      const positive = isPositiveIngredient(key);
      const correct = positive ? value : !value;
      return `<tr><td>${escapeHtml(OPERATOR_LABELS[key] ?? key)}</td><td class="${correct ? "pass-text" : "fail-text"}">${value ? "YES" : "NO"}</td><td>${positive ? "required direct-branch ingredient" : "forbidden/absent in D0M"}</td></tr>`;
    }).join("");
  }

  private renderCovariance(): void {
    const packet = this.requirePacket();
    required<HTMLElement>(this.root, "#d0m-covariance-body").innerHTML = [packet.rotationCovariance, packet.permutationCovariance].map((row) => `
      <tr><td>${row.control}</td><td>${format(row.maximumPositionStateRms)}</td><td>${format(row.maximumVelocityStateRms)}</td><td>${format(row.maximumScalarDelta)}</td></tr>
    `).join("");
  }

  private renderTimeRefinement(): void {
    const refinement = this.requirePacket().timeRefinement;
    required<HTMLElement>(this.root, "#d0m-dt-a").textContent = format(refinement.anisotropyDeltaMediumFine);
    required<HTMLElement>(this.root, "#d0m-dt-t").textContent = format(refinement.tangentialDeltaMediumFine);
    required<HTMLElement>(this.root, "#d0m-dt-h").textContent = format(refinement.homologyDeltaMediumFine);
    required<HTMLElement>(this.root, "#d0m-dt-energy").textContent = `${format(refinement.energyDriftCoarse)} / ${format(refinement.energyDriftMedium)} / ${format(refinement.energyDriftFine)}`;
  }

  private renderProvenance(): void {
    const packet = this.requirePacket();
    required<HTMLElement>(this.root, "#d0m-source-commit").textContent = packet.producer.sourceCommit;
    required<HTMLElement>(this.root, "#d0m-receipt-hash").textContent = packet.receipt.fullReceiptSha256;
    required<HTMLElement>(this.root, "#d0m-artifact").textContent = `${packet.receipt.artifactId} / ${packet.receipt.workflowRunId}`;
    required<HTMLElement>(this.root, "#d0m-claim-ceiling").textContent = packet.claimCeiling;
  }

  private downloadPacket(): void {
    const packet = this.requirePacket();
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "R13_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
