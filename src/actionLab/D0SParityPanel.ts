import {
  D0S_LEVELS,
  generateD0SMicrobodies,
  runD0SParity,
  type D0SLevelId,
  type D0SLevelMetrics,
  type D0SParityResult,
} from "./d0sMicrobodyParity";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing D0S element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e4) return value.toExponential(4);
  return value.toFixed(7);
}

function template(): string {
  return `
    <section class="d0s-panel card" data-testid="d0s-panel">
      <div class="section-head d0s-head">
        <div>
          <p class="eyebrow">D0S · STATIC REPRESENTATION GATE</p>
          <h2>Одна однородная сфера → равное количество в одинаковых микротелах</h2>
          <p>Статическая проверка внешних W0/W1 до любой динамики. Точки здесь не являются rigid voxel-элементами и не изображаются как уже связанный сгусток: это независимая равновесовая сумма положительных количеств.</p>
        </div>
        <span id="d0s-status" class="audit-badge">RUNNING D0S</span>
      </div>

      <div class="d0s-controls">
        <label>Refinement
          <select id="d0s-level">
            ${D0S_LEVELS.map((level) => `<option value="${level.id}" ${level.id === "N3072" ? "selected" : ""}>${level.id} · ${level.shellCount} radial strata</option>`).join("")}
          </select>
        </label>
        <button id="d0s-export">EXPORT D0S RECEIPT</button>
      </div>

      <div class="d0s-primary-grid">
        <article class="d0s-geometry-card">
          <div class="section-head"><div><p class="eyebrow">EQUAL MICROBODY REPRESENTATION</p><h2>XY projection of the frozen refinement</h2></div><span id="d0s-point-count"></span></div>
          <canvas id="d0s-packing-canvas" width="760" height="620" data-testid="d0s-packing-canvas"></canvas>
          <p class="d0s-note">Каждая точка несёт одинаковое положительное количество. Пунктирная окружность — аналитический reference radius, не твёрдая граница микротельной системы.</p>
        </article>

        <article class="d0s-metrics-card" data-testid="d0s-metrics">
          <div class="section-head"><div><p class="eyebrow">SELECTED LEVEL</p><h2 id="d0s-level-title"></h2></div></div>
          <dl>
            <div><dt>shell counts</dt><dd id="d0s-shell-counts"></dd></div>
            <div><dt>amount closure residual</dt><dd id="d0s-amount-residual"></dd></div>
            <div><dt>COM residual / R</dt><dd id="d0s-com-residual"></dd></div>
            <div><dt>equal-weight spread / mean</dt><dd id="d0s-weight-spread"></dd></div>
            <div><dt>max relative W0 error</dt><dd id="d0s-w0-error"></dd></div>
            <div><dt>max relative |W1| error</dt><dd id="d0s-w1-error"></dd></div>
            <div><dt>max W1 vector error</dt><dd id="d0s-vector-error"></dd></div>
            <div><dt>max W0 orientation spread</dt><dd id="d0s-w0-spread"></dd></div>
            <div><dt>max W1 orientation spread</dt><dd id="d0s-w1-spread"></dd></div>
            <div><dt>permutation delta</dt><dd id="d0s-permutation"></dd></div>
            <div><dt>rotation covariance delta</dt><dd id="d0s-rotation"></dd></div>
          </dl>
          <div class="d0s-worst" id="d0s-worst" data-testid="d0s-worst"></div>
        </article>
      </div>

      <article class="d0s-chart-card">
        <div class="section-head"><div><p class="eyebrow">REFINEMENT</p><h2>Ошибка и ориентационный отпечаток уменьшаются с N</h2></div><span>log scale</span></div>
        <canvas id="d0s-refinement-canvas" width="1080" height="430" data-testid="d0s-refinement-canvas"></canvas>
        <div class="d0s-legend">
          <span class="d0s-w0-line">max W0 error</span>
          <span class="d0s-vector-line">max W1 vector error</span>
          <span class="d0s-spread-line">max orientation spread</span>
          <span class="d0s-p4-line">P4 angular power</span>
        </div>
      </article>

      <div class="d0s-tables-grid">
        <article class="d0s-table-card" data-testid="d0s-refinement-table">
          <div class="section-head"><div><p class="eyebrow">N48 → N3072</p><h2>Frozen refinement receipt</h2></div></div>
          <table>
            <thead><tr><th>level</th><th>W0 err</th><th>W1 vec err</th><th>orientation</th><th>P2</th><th>P4</th></tr></thead>
            <tbody id="d0s-refinement-body"></tbody>
          </table>
        </article>

        <article class="d0s-table-card" data-testid="d0s-gates">
          <div class="section-head"><div><p class="eyebrow">G01–G17</p><h2>Preregistered gates</h2></div></div>
          <table>
            <thead><tr><th>gate</th><th>metric</th><th>value</th><th>threshold</th><th>status</th></tr></thead>
            <tbody id="d0s-gates-body"></tbody>
          </table>
        </article>
      </div>

      <article class="d0s-multipole-card" data-testid="d0s-multipoles">
        <div class="section-head"><div><p class="eyebrow">REAL ANGULAR BASIS</p><h2>Multipole powers l=1…4</h2></div><span>no complex ontology</span></div>
        <table>
          <thead><tr><th>level</th><th>P1</th><th>P2</th><th>P3</th><th>P4</th></tr></thead>
          <tbody id="d0s-multipole-body"></tbody>
        </table>
      </article>

      <div id="d0s-conclusion" class="d0s-conclusion" data-testid="d0s-conclusion"></div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class D0SParityPanel {
  private readonly result: D0SParityResult;
  private selectedLevel: D0SLevelId = "N3072";

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.result = runD0SParity({ radius: 1, density: 1 });
    this.bind();
    this.render();
  }

  private bind(): void {
    const select = required<HTMLSelectElement>(this.root, "#d0s-level");
    select.addEventListener("change", () => {
      this.selectedLevel = select.value as D0SLevelId;
      this.renderSelected();
    });
    required<HTMLButtonElement>(this.root, "#d0s-export").addEventListener("click", () => this.exportReceipt());
  }

  private selected(): D0SLevelMetrics {
    const level = this.result.levels.find((entry) => entry.definition.id === this.selectedLevel);
    if (!level) throw new Error(`Unknown D0S level ${this.selectedLevel}`);
    return level;
  }

  private render(): void {
    const pass = this.result.verdict === "D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS";
    const status = required<HTMLElement>(this.root, "#d0s-status");
    status.textContent = pass ? "D0S STATIC PARITY PASS" : "D0S BLOCKER";
    status.className = `audit-badge ${pass ? "pass" : "fail"}`;
    this.renderSelected();
    this.renderRefinementChart();
    this.renderTables();

    const conclusion = required<HTMLElement>(this.root, "#d0s-conclusion");
    conclusion.innerHTML = pass
      ? `<strong>${this.result.verdict}</strong><p>Равновесовая микротельная сумма сходится к аналитической однородной сфере на зарегистрированных внешних пробниках. Это закрывает только статическое представление. D0M теперь может быть открыт как отдельный gate с каждым микротелом в собственном подвижном объекте.</p><small>Claim ceiling: ${this.result.claimCeiling}. Никакой физический упор, сила, масштаб или устойчивый сгусток этим не установлены.</small>`
      : `<strong>${this.result.verdict}</strong><p>Статическая замена не прошла замороженный corridor. D0M остаётся закрыт.</p>`;
  }

  private renderSelected(): void {
    const level = this.selected();
    required<HTMLElement>(this.root, "#d0s-level-title").textContent = `${level.definition.id} fixed microbodies`;
    required<HTMLElement>(this.root, "#d0s-point-count").textContent = `${level.definition.count} equal positive bodies`;
    required<HTMLElement>(this.root, "#d0s-shell-counts").textContent = level.shellCounts.join(" · ");
    required<HTMLElement>(this.root, "#d0s-amount-residual").textContent = format(level.amountClosureResidual);
    required<HTMLElement>(this.root, "#d0s-com-residual").textContent = format(level.centreOfAmountResidualOverR);
    required<HTMLElement>(this.root, "#d0s-weight-spread").textContent = format(level.equalWeightSpreadOverMean);
    required<HTMLElement>(this.root, "#d0s-w0-error").textContent = format(level.maximumW0RelativeError);
    required<HTMLElement>(this.root, "#d0s-w1-error").textContent = format(level.maximumW1MagnitudeRelativeError);
    required<HTMLElement>(this.root, "#d0s-vector-error").textContent = format(level.maximumW1VectorRelativeError);
    required<HTMLElement>(this.root, "#d0s-w0-spread").textContent = format(level.maximumW0OrientationSpread);
    required<HTMLElement>(this.root, "#d0s-w1-spread").textContent = format(level.maximumW1OrientationSpread);
    required<HTMLElement>(this.root, "#d0s-permutation").textContent = format(Math.max(level.permutationW0Delta, level.permutationW1Delta));
    required<HTMLElement>(this.root, "#d0s-rotation").textContent = format(Math.max(level.rotationW0Delta, level.rotationW1Delta));
    required<HTMLElement>(this.root, "#d0s-worst").textContent = `Worst vector probe: r/R=${level.worstVectorProbe.radiusRatio}, direction=${level.worstVectorProbe.directionId}, relative error=${format(level.worstVectorProbe.w1VectorRelativeError)}.`;
    this.drawPacking(level);
  }

  private drawPacking(level: D0SLevelMetrics): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#d0s-packing-canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("D0S packing canvas unavailable");
    const { bodies } = generateD0SMicrobodies({ radius: 1, density: 1 }, level.definition);
    const scale = 0.43 * Math.min(canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(245,226,142,.58)";
    context.lineWidth = 2;
    context.setLineDash([8, 7]);
    context.beginPath();
    context.arc(cx, cy, scale, 0, 2 * Math.PI);
    context.stroke();
    context.setLineDash([]);

    const step = Math.max(1, Math.floor(bodies.length / 1800));
    for (let index = 0; index < bodies.length; index += step) {
      const body = bodies[index]!;
      const shellFraction = (body.shellIndex + 1) / level.definition.shellCount;
      const alpha = 0.30 + 0.64 * shellFraction;
      context.fillStyle = `rgba(112, 226, 184, ${alpha})`;
      const radius = bodies.length > 1000 ? 1.4 : bodies.length > 200 ? 2 : 3.2;
      context.beginPath();
      context.arc(cx + body.position[0] * scale, cy - body.position[1] * scale, radius, 0, 2 * Math.PI);
      context.fill();
    }

    context.fillStyle = "rgba(244,238,206,.85)";
    context.font = "13px ui-monospace, monospace";
    context.fillText("XY projection · display decimation does not affect compute", 18, 28);
  }

  private renderRefinementChart(): void {
    const canvas = required<HTMLCanvasElement>(this.root, "#d0s-refinement-canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("D0S refinement canvas unavailable");
    const left = 80, right = 28, top = 25, bottom = 58;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    const minimum = 1e-4;
    const maximum = 3e-1;
    const yOf = (value: number) => top + (Math.log10(maximum) - Math.log10(Math.max(minimum, value))) / (Math.log10(maximum) - Math.log10(minimum)) * height;
    const xOf = (index: number) => left + index / (this.result.levels.length - 1) * width;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = "12px ui-monospace, monospace";
    context.fillStyle = "rgba(225,238,232,.72)";
    context.strokeStyle = "rgba(255,255,255,.11)";
    for (const tick of [1e-1, 1e-2, 1e-3, 1e-4]) {
      const y = yOf(tick);
      context.beginPath(); context.moveTo(left, y); context.lineTo(canvas.width - right, y); context.stroke();
      context.fillText(tick.toExponential(0), 18, y + 4);
    }
    this.result.levels.forEach((level, index) => context.fillText(level.definition.id, xOf(index) - 18, canvas.height - 24));

    const draw = (selector: (level: D0SLevelMetrics) => number, stroke: string, dash: number[] = []) => {
      context.strokeStyle = stroke;
      context.lineWidth = 3;
      context.setLineDash(dash);
      context.beginPath();
      this.result.levels.forEach((level, index) => {
        const x = xOf(index);
        const y = yOf(selector(level));
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
      context.setLineDash([]);
      this.result.levels.forEach((level, index) => {
        context.fillStyle = stroke;
        context.beginPath(); context.arc(xOf(index), yOf(selector(level)), 4, 0, 2 * Math.PI); context.fill();
      });
    };
    draw((level) => level.maximumW0RelativeError, "#70e2b8");
    draw((level) => level.maximumW1VectorRelativeError, "#f4d675", [8, 5]);
    draw((level) => Math.max(level.maximumW0OrientationSpread, level.maximumW1OrientationSpread), "#7cb7ff", [3, 4]);
    draw((level) => level.multipoles.l4, "#e99bff", [10, 4, 2, 4]);
  }

  private renderTables(): void {
    required<HTMLElement>(this.root, "#d0s-refinement-body").innerHTML = this.result.levels.map((level) => `
      <tr>
        <td>${level.definition.id}</td>
        <td>${format(level.maximumW0RelativeError)}</td>
        <td>${format(level.maximumW1VectorRelativeError)}</td>
        <td>${format(Math.max(level.maximumW0OrientationSpread, level.maximumW1OrientationSpread))}</td>
        <td>${format(level.multipoles.l2)}</td>
        <td>${format(level.multipoles.l4)}</td>
      </tr>
    `).join("");

    required<HTMLElement>(this.root, "#d0s-gates-body").innerHTML = this.result.gates.map((gate) => `
      <tr>
        <td>${gate.id}</td><td>${gate.label}</td><td>${format(gate.value)}</td>
        <td>${gate.comparison === "MAX" ? "≤" : ">"} ${format(gate.threshold)}</td>
        <td class="${gate.pass ? "pass-text" : "fail-text"}">${gate.pass ? "PASS" : "FAIL"}</td>
      </tr>
    `).join("");

    required<HTMLElement>(this.root, "#d0s-multipole-body").innerHTML = this.result.levels.map((level) => `
      <tr><td>${level.definition.id}</td><td>${format(level.multipoles.l1)}</td><td>${format(level.multipoles.l2)}</td><td>${format(level.multipoles.l3)}</td><td>${format(level.multipoles.l4)}</td></tr>
    `).join("");
  }

  private exportReceipt(): void {
    const receipt = {
      ...this.result,
      commit: APP_COMMIT,
      preregistration: "R13_D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_V1_PREREGISTRATION",
      selectedLevel: this.selectedLevel,
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "VOXELLAB_D0S_STATIC_MICROBODY_PARITY_RECEIPT_V1.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
