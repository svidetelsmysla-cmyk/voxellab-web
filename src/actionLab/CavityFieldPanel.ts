import {
  buildCavityFixture,
  cavitySummary,
  radialCavityProfile,
  sampleCavityPoint,
  type CavityChannel,
  type CavityFixture,
} from "./cavityFieldMap";
import { vectorNorm, type Vec3 } from "./math";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing C1 cavity element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e5) return value.toExponential(5);
  return value.toFixed(6);
}

function template(): string {
  return `
    <section class="c1-cavity card" data-testid="c1-cavity-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">C1 · BODY + CAVITY + EQUAL-BODY BACKGROUND</p>
          <h2>Полость из множества равных тел и карты W</h2>
          <p>Красное тело заменяет ровно то положительное количество, которое удалено из равномерной контрольной взвеси. Карты показывают тело, фон, deficit и их направленный residual раздельно.</p>
        </div>
        <span id="c1-status" class="audit-badge pass">C1 VISUAL METHOD CONTROL</span>
      </div>

      <div class="c1-controls">
        <label>Канал карты
          <select id="c1-channel">
            <option value="RESIDUAL_W1">|W1| body − cavity deficit</option>
            <option value="DEFICIT_W0">W0 cavity deficit</option>
            <option value="BODY_W0">W0 central body</option>
            <option value="BACKGROUND_W0">W0 remaining background</option>
            <option value="BASELINE_W0">W0 uniform baseline</option>
          </select>
        </label>
        <label>Refinement
          <select id="c1-refinement">
            <option value="N192">N192</option>
            <option value="N768" selected>N768</option>
            <option value="N3072">N3072</option>
          </select>
        </label>
        <label>Радиус каверны / Rbody
          <input id="c1-cavity-ratio" type="range" min="1.3" max="3.4" step="0.05" value="2.40">
        </label>
        <output id="c1-cavity-ratio-value">2.40</output>
        <button id="c1-export">EXPORT C1 RECEIPT</button>
      </div>

      <div class="c1-grid">
        <article>
          <div class="section-head"><div><p class="eyebrow">PARTICLE CROSS-SECTION</p><h2>Центральное тело и фактическая полость</h2></div><span id="c1-particle-count"></span></div>
          <canvas id="c1-scene" width="760" height="620" data-testid="c1-scene"></canvas>
          <p class="c1-note">Синие точки — реальные равные микротела фона. Пунктир — радиус удалённой области. Это prescribed diagnostic cavity, не ещё самосформированная динамическая каверна.</p>
        </article>
        <article>
          <div class="section-head"><div><p class="eyebrow">SPATIAL W MAP</p><h2 id="c1-map-title"></h2></div><span>XY slice · arrows = W1</span></div>
          <canvas id="c1-map" width="760" height="620" data-testid="c1-map"></canvas>
          <p class="c1-note">Цвет показывает выбранный положительный канал или модуль направленного residual. Стрелки не являются физической силой до receiver/cadence gate.</p>
        </article>
      </div>

      <div class="c1-grid">
        <article class="c1-ledger" data-testid="c1-ledger">
          <div class="section-head"><div><p class="eyebrow">POSITIVE AMOUNT LEDGER</p><h2>Количество не исчезает</h2></div></div>
          <dl>
            <div><dt>baseline amount</dt><dd id="c1-baseline-amount"></dd></div>
            <div><dt>active background amount</dt><dd id="c1-background-amount"></dd></div>
            <div><dt>removed amount / deficit support</dt><dd id="c1-removed-amount"></dd></div>
            <div><dt>central body amount</dt><dd id="c1-body-amount"></dd></div>
            <div><dt>current total − baseline</dt><dd id="c1-closure"></dd></div>
            <div><dt>body density / background density</dt><dd id="c1-density-ratio"></dd></div>
          </dl>
        </article>
        <article>
          <div class="section-head"><div><p class="eyebrow">RADIAL PROFILE</p><h2>Фон, каверна и переход</h2></div><span>count / shell volume</span></div>
          <canvas id="c1-profile" width="760" height="360" data-testid="c1-profile"></canvas>
        </article>
      </div>

      <div class="c1-conclusion" data-testid="c1-conclusion">
        <strong>C1 interpretation ceiling</strong>
        <p>Эта сцена показывает, как одна и та же геометрическая полость выглядит одновременно в частицах, scalar W0 и vector W1. Она не доказывает, что текущий prescribed профиль сам возникает из динамики. Следующий обязательный gate — C0/C1 relaxation и boundary-independence.</p>
      </div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class CavityFieldPanel {
  private fixture: CavityFixture = {
    reservoirRadius: 5,
    bodyRadius: 0.65,
    cavityRadius: 1.56,
    backgroundDensity: 1,
    refinement: "N768",
  };
  private channel: CavityChannel = "RESIDUAL_W1";

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.bind();
    this.render();
  }

  private bind(): void {
    const channel = required<HTMLSelectElement>(this.root, "#c1-channel");
    const refinement = required<HTMLSelectElement>(this.root, "#c1-refinement");
    const ratio = required<HTMLInputElement>(this.root, "#c1-cavity-ratio");
    const update = () => {
      this.channel = channel.value as CavityChannel;
      this.fixture = {
        ...this.fixture,
        refinement: refinement.value as CavityFixture["refinement"],
        cavityRadius: this.fixture.bodyRadius * Number(ratio.value),
      };
      this.render();
    };
    channel.addEventListener("change", update);
    refinement.addEventListener("change", update);
    ratio.addEventListener("input", update);
    required<HTMLButtonElement>(this.root, "#c1-export").addEventListener("click", () => this.exportReceipt());
  }

  private render(): void {
    const built = buildCavityFixture(this.fixture);
    const summary = cavitySummary(this.fixture);
    required<HTMLOutputElement>(this.root, "#c1-cavity-ratio-value").value = (this.fixture.cavityRadius / this.fixture.bodyRadius).toFixed(2);
    required<HTMLElement>(this.root, "#c1-particle-count").textContent = `${built.ledger.activeParticleCount} / ${built.ledger.particleCount} background bodies`;
    required<HTMLElement>(this.root, "#c1-baseline-amount").textContent = format(built.ledger.baselineAmount);
    required<HTMLElement>(this.root, "#c1-background-amount").textContent = format(built.ledger.activeBackgroundAmount);
    required<HTMLElement>(this.root, "#c1-removed-amount").textContent = format(built.ledger.removedBackgroundAmount);
    required<HTMLElement>(this.root, "#c1-body-amount").textContent = format(built.ledger.bodyAmount);
    required<HTMLElement>(this.root, "#c1-closure").textContent = format(built.ledger.closureResidual);
    required<HTMLElement>(this.root, "#c1-density-ratio").textContent = format(summary.bodyDensityRatio);
    this.drawScene(built.particles);
    this.drawMap(built.particles, built.ledger);
    this.drawProfile();
  }

  private drawScene(particles: ReturnType<typeof buildCavityFixture>["particles"]): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#c1-scene");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("C1 scene canvas unavailable");
    const scale = 0.47 * Math.min(canvas.width, canvas.height) / this.fixture.reservoirRadius;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const active = particles.filter((p) => p.active && Math.abs(p.position[2]) < 0.45);
    for (const particle of active) {
      const depth = 1 - Math.abs(particle.position[2]) / 0.45;
      context.fillStyle = `rgba(100,174,245,${0.28 + 0.68 * depth})`;
      context.beginPath();
      context.arc(cx + particle.position[0] * scale, cy - particle.position[1] * scale, 2.1, 0, 2 * Math.PI);
      context.fill();
    }
    context.fillStyle = "rgba(221,100,76,.96)";
    context.beginPath();
    context.arc(cx, cy, this.fixture.bodyRadius * scale, 0, 2 * Math.PI);
    context.fill();
    context.strokeStyle = "rgba(245,220,126,.92)";
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.arc(cx, cy, this.fixture.cavityRadius * scale, 0, 2 * Math.PI);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = "rgba(255,255,255,.18)";
    context.beginPath();
    context.arc(cx, cy, this.fixture.reservoirRadius * scale, 0, 2 * Math.PI);
    context.stroke();
  }

  private drawMap(
    particles: ReturnType<typeof buildCavityFixture>["particles"],
    ledger: ReturnType<typeof buildCavityFixture>["ledger"],
  ): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#c1-map");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("C1 map canvas unavailable");
    const extent = 3.2;
    const cells = 58;
    const values: { value: number; vector: Vec3 }[] = [];
    for (let iy = 0; iy < cells; iy += 1) {
      for (let ix = 0; ix < cells; ix += 1) {
        const probe: Vec3 = [
          -extent + 2 * extent * (ix + 0.5) / cells,
          extent - 2 * extent * (iy + 0.5) / cells,
          0,
        ];
        const sample = sampleCavityPoint(probe, this.fixture, particles, ledger);
        let value: number;
        if (this.channel === "RESIDUAL_W1") value = sample.residual.w1Magnitude;
        else if (this.channel === "DEFICIT_W0") value = sample.deficit.w0;
        else if (this.channel === "BODY_W0") value = sample.body.w0;
        else if (this.channel === "BACKGROUND_W0") value = sample.background.w0;
        else value = sample.baseline.w0;
        values.push({ value, vector: sample.residual.w1 });
      }
    }
    const sorted = values.map((v) => v.value).sort((a, b) => a - b);
    const cap = sorted[Math.floor(0.96 * (sorted.length - 1))] || 1;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cw = canvas.width / cells, ch = canvas.height / cells;
    values.forEach((entry, index) => {
      const ix = index % cells, iy = Math.floor(index / cells);
      const t = Math.min(1, Math.max(0, entry.value / cap));
      const alpha = 0.08 + 0.88 * Math.sqrt(t);
      context.fillStyle = this.channel === "DEFICIT_W0"
        ? `rgba(242,194,86,${alpha})`
        : this.channel === "BODY_W0"
          ? `rgba(230,99,77,${alpha})`
          : `rgba(76,188,221,${alpha})`;
      context.fillRect(ix * cw, iy * ch, cw + 1, ch + 1);
    });
    if (this.channel === "RESIDUAL_W1") {
      context.strokeStyle = "rgba(255,255,255,.78)";
      context.lineWidth = 1.25;
      for (let iy = 3; iy < cells; iy += 5) {
        for (let ix = 3; ix < cells; ix += 5) {
          const entry = values[iy * cells + ix]!;
          const magnitude = vectorNorm(entry.vector);
          if (magnitude < 1e-9) continue;
          const length = 13 * Math.min(1, magnitude / Math.max(cap, 1e-9));
          const x = (ix + 0.5) * cw, y = (iy + 0.5) * ch;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + length * entry.vector[0] / magnitude, y - length * entry.vector[1] / magnitude);
          context.stroke();
        }
      }
    }
    const label = this.channel === "RESIDUAL_W1" ? "|W1| body − deficit"
      : this.channel === "DEFICIT_W0" ? "W0 cavity deficit"
        : this.channel === "BODY_W0" ? "W0 central body"
          : this.channel === "BACKGROUND_W0" ? "W0 remaining background"
            : "W0 uniform baseline";
    required<HTMLElement>(this.root, "#c1-map-title").textContent = label;
  }

  private drawProfile(): void {
    const rows = radialCavityProfile(this.fixture, 28);
    const canvas = required<HTMLCanvasElement>(this.root, "#c1-profile");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("C1 profile canvas unavailable");
    const left = 54, right = 20, top = 20, bottom = 42;
    const width = canvas.width - left - right, height = canvas.height - top - bottom;
    const maxDensity = Math.max(...rows.map((row) => row.baselineDensity), 1);
    const xOf = (r: number) => left + r / this.fixture.reservoirRadius * width;
    const yOf = (v: number) => top + (1 - v / maxDensity) * height;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(255,255,255,.12)";
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const y = top + (1 - fraction) * height;
      context.beginPath(); context.moveTo(left, y); context.lineTo(canvas.width - right, y); context.stroke();
    }
    const draw = (key: "baselineDensity" | "currentDensity", stroke: string) => {
      context.strokeStyle = stroke;
      context.lineWidth = 2.5;
      context.beginPath();
      rows.forEach((row, index) => {
        const x = xOf(row.radius), y = yOf(row[key]);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    draw("baselineDensity", "rgba(205,220,231,.75)");
    draw("currentDensity", "rgba(92,191,235,.95)");
    context.strokeStyle = "rgba(245,220,126,.9)";
    context.setLineDash([6, 5]);
    const cavityX = xOf(this.fixture.cavityRadius);
    context.beginPath(); context.moveTo(cavityX, top); context.lineTo(cavityX, canvas.height - bottom); context.stroke();
    context.setLineDash([]);
  }

  private exportReceipt(): void {
    const built = buildCavityFixture(this.fixture);
    const profile = radialCavityProfile(this.fixture, 28);
    const receipt = {
      schema: "VOXELLAB_C1_BODY_CAVITY_W_MAPS_V1",
      commit: APP_COMMIT,
      fixture: this.fixture,
      ledger: built.ledger,
      summary: cavitySummary(this.fixture),
      radialProfile: profile,
      status: "PRESCRIBED_CAVITY_VISUAL_METHOD_CONTROL",
      nextGate: "C0_C1_RELAXATION_AND_BOUNDARY_INDEPENDENCE",
      firewalls: [
        "NO_CAVITY_AS_AUTONOMOUS_OBJECT",
        "NO_PRESCRIBED_PROFILE_AS_DYNAMIC_FORMATION",
        "NO_W_MAP_AS_PHYSICAL_FORCE",
        "NO_UPOR_CLAIM",
        "NO_VALIDATION",
      ],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "VOXELLAB_C1_BODY_CAVITY_W_MAPS_RECEIPT.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
