import {
  buildGeneratedCavityResult,
  compareBoundaryResults,
  defaultRelaxationFixture,
  sampleGeneratedPoint,
  type BoundaryGateSummary,
  type BoundaryMode,
  type GeneratedCavityResult,
  type GeneratedWChannel,
} from "./cavityRelaxation";
import { vectorNorm, type Vec3 } from "./math";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";
const BOUNDARIES: BoundaryMode[] = [
  "ANALYTIC_ISOTROPIC_RESERVOIR",
  "SPHERICAL_REPULSIVE_WALL",
  "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL",
];

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing C0/C1 relaxation element: ${selector}`);
  return value;
}

function format(value: number | null): string {
  if (value === null) return "NOT REACHED";
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e5) return value.toExponential(5);
  return value.toFixed(6);
}

function shortBoundary(value: BoundaryMode): string {
  if (value === "ANALYTIC_ISOTROPIC_RESERVOIR") return "B0 analytic reservoir";
  if (value === "SPHERICAL_REPULSIVE_WALL") return "B1 spherical wall";
  return "B2 equal-volume cube";
}

function template(): string {
  return `
    <section class="c01-relax card" data-testid="c01-relaxation-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">C0/C1 · GENERATED CAVITY RELAXATION</p>
          <h2>Подвижная равная взвесь → центральное тело → полость и карты W</h2>
          <p>Все фоновые тела сохраняются. C0 ищет фон без центрального тела; C1 добавляет отдельное сформированное тело и повторно перестраивает ту же взвесь. Итерации — поиск состояния, не физическое время.</p>
        </div>
        <span id="c01-status" class="audit-badge">READY</span>
      </div>

      <div class="c01-controls">
        <label>Граница
          <select id="c01-boundary">
            <option value="ANALYTIC_ISOTROPIC_RESERVOIR">B0 analytic isotropic reservoir</option>
            <option value="SPHERICAL_REPULSIVE_WALL">B1 spherical repulsive wall</option>
            <option value="EQUAL_VOLUME_CUBIC_REPULSIVE_WALL">B2 equal-volume cubic wall</option>
          </select>
        </label>
        <label>Фоновые тела
          <select id="c01-count">
            <option value="96">N96</option>
            <option value="192" selected>N192</option>
          </select>
        </label>
        <label>Состояние сцены
          <select id="c01-state">
            <option value="C1" selected>C1 · after body insertion</option>
            <option value="C0">C0 · background only</option>
          </select>
        </label>
        <label>Канал карты
          <select id="c01-channel">
            <option value="FULL_DELTA_W1">|W1| body + background delta</option>
            <option value="BACKGROUND_DELTA_W1">|W1| background C1 − C0</option>
            <option value="BODY_W0">W0 central body</option>
            <option value="C1_BACKGROUND_W0">W0 C1 relaxed background</option>
            <option value="C0_BACKGROUND_W0">W0 C0 reference background</option>
          </select>
        </label>
        <button id="c01-run">RUN C0/C1 RELAXATION</button>
        <button id="c01-export">EXPORT RECEIPT</button>
      </div>

      <div class="c01-grid">
        <article>
          <div class="section-head"><div><p class="eyebrow">GENERATED PARTICLE STATE</p><h2 id="c01-scene-title">C1 generated distribution</h2></div><span id="c01-particle-summary"></span></div>
          <canvas id="c01-scene" width="760" height="620" data-testid="c01-scene"></canvas>
          <p class="c01-note">Красное тело добавлено к фону; синие микротела не удаляются. Видимая пустая область — результат их нового положения. В C0 тело отсутствует.</p>
        </article>
        <article>
          <div class="section-head"><div><p class="eyebrow">GENERATED W MAP</p><h2 id="c01-map-title">FULL_DELTA_W1</h2></div><span>XY slice · arrows for W1</span></div>
          <canvas id="c01-map" width="760" height="620" data-testid="c01-map"></canvas>
          <p class="c01-note">Каждая исходная карта строится из положительных тел. Delta — операция сравнения C1 с C0, а не отрицательная материя и не физическая сила.</p>
        </article>
      </div>

      <div class="c01-grid">
        <article>
          <div class="section-head"><div><p class="eyebrow">RADIAL DENSITY</p><h2>C0 фон и C1 перестройка</h2></div><span>amount / shell volume</span></div>
          <canvas id="c01-profile" width="760" height="390" data-testid="c01-profile"></canvas>
        </article>
        <article class="c01-metrics" data-testid="c01-metrics">
          <div class="section-head"><div><p class="eyebrow">STATE METRICS</p><h2>Что получилось без ручного радиуса каверны</h2></div></div>
          <dl>
            <div><dt>C0 bulk density RMS error</dt><dd id="c01-c0-rms"></dd></div>
            <div><dt>C0 anisotropy</dt><dd id="c01-c0-anisotropy"></dd></div>
            <div><dt>C0 boundary-shell fraction</dt><dd id="c01-c0-boundary"></dd></div>
            <div><dt>C1 minimum density ratio</dt><dd id="c01-min-ratio"></dd></div>
            <div><dt>C1 cavity radius 50%</dt><dd id="c01-r50"></dd></div>
            <div><dt>C1 cavity radius 90%</dt><dd id="c01-r90"></dd></div>
            <div><dt>nearest background radius</dt><dd id="c01-nearest"></dd></div>
            <div><dt>background amount C1 − C0</dt><dd id="c01-amount-residual"></dd></div>
            <div><dt>C0/C1 convergence flags</dt><dd id="c01-convergence"></dd></div>
          </dl>
        </article>
      </div>

      <article class="c01-comparison" data-testid="c01-comparison">
        <div class="section-head"><div><p class="eyebrow">BOUNDARY DISCRIMINATOR</p><h2>Одна взвесь под тремя способами удержания</h2></div><span id="c01-verdict">NOT RUN</span></div>
        <div class="c01-table-wrap">
          <table>
            <thead><tr><th>Boundary</th><th>C0 bulk RMS</th><th>C0 anisotropy</th><th>Boundary fraction</th><th>Cavity r50</th><th>Cavity r90</th><th>Min density ratio</th></tr></thead>
            <tbody id="c01-comparison-body"></tbody>
          </table>
        </div>
      </article>

      <div class="c01-conclusion" data-testid="c01-conclusion">
        <strong>Interpretation ceiling</strong>
        <p>Это прямой попарный dimensionless relaxation-control. Он проверяет, формируется ли разрежённая область в выбранной численной конструкции и насколько результат зависит от способа удержания конечного объёма. Он не закрывает полный оператор Виктора, физическое время, силу или упор.</p>
      </div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class CavityRelaxationPanel {
  private boundary: BoundaryMode = "ANALYTIC_ISOTROPIC_RESERVOIR";
  private particleCount = 192;
  private state: "C0" | "C1" = "C1";
  private channel: GeneratedWChannel = "FULL_DELTA_W1";
  private results = new Map<BoundaryMode, GeneratedCavityResult>();
  private summary: BoundaryGateSummary | null = null;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.bind();
    this.run();
  }

  private bind(): void {
    required<HTMLSelectElement>(this.root, "#c01-boundary").addEventListener("change", (event) => {
      this.boundary = (event.target as HTMLSelectElement).value as BoundaryMode;
      this.render();
    });
    required<HTMLSelectElement>(this.root, "#c01-count").addEventListener("change", (event) => {
      this.particleCount = Number((event.target as HTMLSelectElement).value);
    });
    required<HTMLSelectElement>(this.root, "#c01-state").addEventListener("change", (event) => {
      this.state = (event.target as HTMLSelectElement).value as "C0" | "C1";
      this.render();
    });
    required<HTMLSelectElement>(this.root, "#c01-channel").addEventListener("change", (event) => {
      this.channel = (event.target as HTMLSelectElement).value as GeneratedWChannel;
      this.render();
    });
    required<HTMLButtonElement>(this.root, "#c01-run").addEventListener("click", () => this.run());
    required<HTMLButtonElement>(this.root, "#c01-export").addEventListener("click", () => this.exportReceipt());
  }

  private run(): void {
    const status = required<HTMLElement>(this.root, "#c01-status");
    status.textContent = "COMPUTING";
    status.className = "audit-badge";
    required<HTMLButtonElement>(this.root, "#c01-run").disabled = true;
    setTimeout(() => {
      try {
        this.results.clear();
        for (const boundaryMode of BOUNDARIES) {
          const fixture = {
            ...defaultRelaxationFixture(boundaryMode),
            particleCount: this.particleCount,
            iterations: this.particleCount >= 192 ? 180 : 150,
          };
          this.results.set(boundaryMode, buildGeneratedCavityResult(fixture));
        }
        this.summary = compareBoundaryResults(BOUNDARIES.map((mode) => this.results.get(mode)!));
        status.textContent = this.summary.verdict;
        status.className = this.summary.verdict.endsWith("PASS") ? "audit-badge pass" : "audit-badge warning";
        this.render();
      } catch (error) {
        status.textContent = `BLOCKED · ${String(error)}`;
        status.className = "audit-badge warning";
      } finally {
        required<HTMLButtonElement>(this.root, "#c01-run").disabled = false;
      }
    }, 0);
  }

  private selectedResult(): GeneratedCavityResult | null {
    return this.results.get(this.boundary) ?? null;
  }

  private render(): void {
    const result = this.selectedResult();
    if (!result) return;
    required<HTMLElement>(this.root, "#c01-scene-title").textContent = this.state === "C0" ? "C0 relaxed background" : "C1 after formed-body insertion";
    required<HTMLElement>(this.root, "#c01-particle-summary").textContent = `${shortBoundary(this.boundary)} · N${result.fixture.particleCount}`;
    required<HTMLElement>(this.root, "#c01-map-title").textContent = this.channel;
    required<HTMLElement>(this.root, "#c01-c0-rms").textContent = format(result.c0.metrics.bulkDensityRmsRelativeError);
    required<HTMLElement>(this.root, "#c01-c0-anisotropy").textContent = format(result.c0.metrics.anisotropy);
    required<HTMLElement>(this.root, "#c01-c0-boundary").textContent = format(result.c0.metrics.boundaryShellFraction);
    required<HTMLElement>(this.root, "#c01-min-ratio").textContent = format(result.cavity.minimumDensityRatio);
    required<HTMLElement>(this.root, "#c01-r50").textContent = format(result.cavity.cavityRadius50);
    required<HTMLElement>(this.root, "#c01-r90").textContent = format(result.cavity.cavityRadius90);
    required<HTMLElement>(this.root, "#c01-nearest").textContent = format(result.cavity.nearestBackgroundRadius);
    required<HTMLElement>(this.root, "#c01-amount-residual").textContent = format(result.cavity.backgroundAmountResidual);
    required<HTMLElement>(this.root, "#c01-convergence").textContent = `${result.c0.metrics.converged ? "PASS" : "CAP"} / ${result.c1.metrics.converged ? "PASS" : "CAP"}`;
    this.drawScene(result);
    this.drawMap(result);
    this.drawProfile(result);
    this.drawComparison();
  }

  private drawScene(result: GeneratedCavityResult): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#c01-scene");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("C0/C1 scene canvas unavailable");
    const positions = this.state === "C0" ? result.c0.positions : result.c1.positions;
    const extent = result.fixture.reservoirRadius * 1.06;
    const scale = 0.47 * Math.min(canvas.width, canvas.height) / extent;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const slice = 0.48;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const selected = positions.filter((position) => Math.abs(position[2]) < slice);
    for (const position of selected) {
      const depth = 1 - Math.abs(position[2]) / slice;
      context.fillStyle = `rgba(92,183,241,${0.30 + 0.66 * depth})`;
      context.beginPath();
      context.arc(cx + position[0] * scale, cy - position[1] * scale, 2.35, 0, 2 * Math.PI);
      context.fill();
    }
    if (this.state === "C1") {
      context.fillStyle = "rgba(222,99,73,.97)";
      context.beginPath();
      context.arc(cx, cy, result.fixture.bodyRadius * scale, 0, 2 * Math.PI);
      context.fill();
      for (const [radius, stroke] of [[result.cavity.cavityRadius50, "rgba(245,216,116,.95)"], [result.cavity.cavityRadius90, "rgba(255,255,255,.45)"]] as const) {
        if (radius === null) continue;
        context.strokeStyle = stroke;
        context.lineWidth = 2;
        context.setLineDash([7, 6]);
        context.beginPath();
        context.arc(cx, cy, radius * scale, 0, 2 * Math.PI);
        context.stroke();
      }
      context.setLineDash([]);
    }
    context.strokeStyle = "rgba(255,255,255,.18)";
    context.lineWidth = 1;
    if (result.fixture.boundaryMode === "EQUAL_VOLUME_CUBIC_REPULSIVE_WALL") {
      const half = result.fixture.reservoirRadius * Math.cbrt(Math.PI / 6);
      context.strokeRect(cx - half * scale, cy - half * scale, 2 * half * scale, 2 * half * scale);
    } else {
      context.beginPath();
      context.arc(cx, cy, result.fixture.reservoirRadius * scale, 0, 2 * Math.PI);
      context.stroke();
    }
  }

  private drawMap(result: GeneratedCavityResult): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#c01-map");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("C0/C1 map canvas unavailable");
    const extent = 3.2;
    const cells = 48;
    const values: { value: number; vector: Vec3 }[] = [];
    for (let iy = 0; iy < cells; iy += 1) {
      for (let ix = 0; ix < cells; ix += 1) {
        const probe: Vec3 = [
          -extent + 2 * extent * (ix + 0.5) / cells,
          extent - 2 * extent * (iy + 0.5) / cells,
          0,
        ];
        const sample = sampleGeneratedPoint(probe, result);
        if (this.channel === "C0_BACKGROUND_W0") values.push({ value: sample.c0Background.w0, vector: sample.c0Background.w1 });
        else if (this.channel === "C1_BACKGROUND_W0") values.push({ value: sample.c1Background.w0, vector: sample.c1Background.w1 });
        else if (this.channel === "BODY_W0") values.push({ value: sample.body.w0, vector: sample.body.w1 });
        else if (this.channel === "BACKGROUND_DELTA_W1") values.push({ value: sample.backgroundDelta.w1Magnitude, vector: sample.backgroundDelta.w1 });
        else values.push({ value: sample.fullDelta.w1Magnitude, vector: sample.fullDelta.w1 });
      }
    }
    const sorted = values.map((entry) => entry.value).sort((a, b) => a - b);
    const cap = sorted[Math.floor(0.96 * (sorted.length - 1))] || 1;
    const cw = canvas.width / cells, ch = canvas.height / cells;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    values.forEach((entry, index) => {
      const ix = index % cells, iy = Math.floor(index / cells);
      const ratio = Math.min(1, Math.max(0, entry.value / cap));
      const alpha = 0.06 + 0.9 * Math.sqrt(ratio);
      context.fillStyle = this.channel === "BODY_W0"
        ? `rgba(226,101,76,${alpha})`
        : this.channel.includes("DELTA")
          ? `rgba(240,190,80,${alpha})`
          : `rgba(67,185,224,${alpha})`;
      context.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
    });
    if (this.channel.endsWith("W1")) {
      context.strokeStyle = "rgba(255,255,255,.78)";
      context.lineWidth = 1.2;
      for (let iy = 3; iy < cells; iy += 5) {
        for (let ix = 3; ix < cells; ix += 5) {
          const entry = values[iy * cells + ix]!;
          const magnitude = vectorNorm(entry.vector);
          if (magnitude < 1e-10) continue;
          const length = 15 * Math.min(1, entry.value / Math.max(cap, 1e-12));
          const x = (ix + 0.5) * cw, y = (iy + 0.5) * ch;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + length * entry.vector[0] / magnitude, y - length * entry.vector[1] / magnitude);
          context.stroke();
        }
      }
    }
  }

  private drawProfile(result: GeneratedCavityResult): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#c01-profile");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("C0/C1 profile canvas unavailable");
    const left = 58, right = 22, top = 24, bottom = 44;
    const width = canvas.width - left - right, height = canvas.height - top - bottom;
    const maximum = Math.max(...result.radialProfile.flatMap((row) => [row.c0Density, row.c1Density]), result.fixture.backgroundDensity, 1);
    const xOf = (radius: number) => left + radius / result.fixture.reservoirRadius * width;
    const yOf = (density: number) => top + (1 - density / maximum) * height;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(255,255,255,.12)";
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const y = top + (1 - fraction) * height;
      context.beginPath(); context.moveTo(left, y); context.lineTo(canvas.width - right, y); context.stroke();
    }
    const draw = (key: "c0Density" | "c1Density", stroke: string) => {
      context.strokeStyle = stroke;
      context.lineWidth = 2.7;
      context.beginPath();
      result.radialProfile.forEach((row, index) => {
        const x = xOf(row.radius), y = yOf(row[key]);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    context.strokeStyle = "rgba(180,196,190,.55)";
    context.setLineDash([5, 5]);
    const targetY = yOf(result.fixture.backgroundDensity);
    context.beginPath(); context.moveTo(left, targetY); context.lineTo(canvas.width - right, targetY); context.stroke();
    context.setLineDash([]);
    draw("c0Density", "rgba(185,208,223,.80)");
    draw("c1Density", "rgba(75,190,232,.98)");
    for (const [radius, stroke] of [[result.fixture.bodyRadius, "rgba(224,98,73,.9)"], [result.cavity.cavityRadius50, "rgba(245,216,116,.9)"], [result.cavity.cavityRadius90, "rgba(255,255,255,.45)"]] as const) {
      if (radius === null) continue;
      context.strokeStyle = stroke;
      context.setLineDash([6, 5]);
      const x = xOf(radius);
      context.beginPath(); context.moveTo(x, top); context.lineTo(x, canvas.height - bottom); context.stroke();
    }
    context.setLineDash([]);
  }

  private drawComparison(): void {
    const body = required<HTMLTableSectionElement>(this.root, "#c01-comparison-body");
    const verdict = required<HTMLElement>(this.root, "#c01-verdict");
    if (!this.summary) return;
    verdict.textContent = this.summary.verdict;
    body.innerHTML = this.summary.rows.map((row) => `
      <tr>
        <td>${shortBoundary(row.boundaryMode)}</td>
        <td>${format(row.c0BulkDensityError)}</td>
        <td>${format(row.c0Anisotropy)}</td>
        <td>${format(row.c0BoundaryShellFraction)}</td>
        <td>${format(row.c1CavityRadius50)}</td>
        <td>${format(row.c1CavityRadius90)}</td>
        <td>${format(row.c1MinimumDensityRatio)}</td>
      </tr>
    `).join("");
  }

  private exportReceipt(): void {
    if (!this.summary) return;
    const receipt = {
      schema: "VOXELLAB_C0_C1_GENERATED_CAVITY_RELAXATION_V1",
      commit: APP_COMMIT,
      particleCount: this.particleCount,
      selectedBoundary: this.boundary,
      summary: this.summary,
      results: BOUNDARIES.map((boundaryMode) => {
        const result = this.results.get(boundaryMode)!;
        return {
          fixture: result.fixture,
          c0Metrics: result.c0.metrics,
          c1Metrics: result.c1.metrics,
          cavityMetrics: result.cavity,
          radialProfile: result.radialProfile,
        };
      }),
      claimCeiling: "DIRECT_PAIRWISE_DIMENSIONLESS_RELAXATION_CONTROL_ONLY",
      nextGate: "C2_TWO_FORMED_BODIES_TWO_GENERATED_CAVITIES_QUASISTATIC",
      firewalls: [
        "NO_BACKGROUND_AMOUNT_DESTRUCTION",
        "NO_CAVITY_AS_NEGATIVE_SUBSTANCE",
        "NO_PHYSICAL_TIME",
        "NO_W_MAP_AS_PHYSICAL_FORCE",
        "NO_UPOR_CLAIM",
        "NO_VALIDATION",
      ],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "VOXELLAB_C0_C1_GENERATED_CAVITY_RELAXATION_RECEIPT.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
