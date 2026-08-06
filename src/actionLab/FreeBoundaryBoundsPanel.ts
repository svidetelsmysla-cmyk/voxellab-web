import {
  freeBoundaryBounds,
  freeBoundaryParity,
  referenceRows,
  type FreeBoundaryBranchStatus,
  type FreeBoundaryModel,
} from "./freeBoundaryBounds";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing A2B element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-6 || Math.abs(value) >= 1e5) return value.toExponential(6);
  return value.toFixed(8);
}

function statusLabel(status: FreeBoundaryBranchStatus): string {
  if (status === "NO_REFERENCE_CONFLICT") return "NO REFERENCE CONFLICT";
  if (status === "DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER") return "DISTINCT-CENTRE TOPOLOGY BLOCKER";
  return "FREE BOUNDARY REQUIRED";
}

function template(): string {
  return `
    <section class="free-boundary-a2b card" data-testid="free-boundary-a2b-panel">
      <div class="section-head a2b-head">
        <div>
          <p class="eyebrow">A2B · VOLUME-PRESERVING FREE BOUNDARY</p>
          <h2>Линза перекрытия — не общая материя, а требование перераспределения</h2>
          <p>Два насыщенных сгустка не могут занимать одно место двумя количествами. Красная линза показывает объём, который обязан выйти из конфликтной области. Пунктирные оболочки — только нижняя граница возможной дальности деформации.</p>
        </div>
        <span id="a2b-status" class="audit-badge pass">RUNNING A2B</span>
      </div>

      <div class="a2b-controls">
        <label>Разделение центров d/R
          <input id="a2b-separation" type="range" min="0" max="2.5" step="0.001" value="1.200">
        </label>
        <output id="a2b-separation-value">1.200</output>
        <button id="a2b-contact">КАСАНИЕ 2R</button>
        <button id="a2b-default">d=1.2R</button>
        <button id="a2b-peak">A2 CONTROL PEAK</button>
        <button id="a2b-concentric">СОВПАДЕНИЕ ЦЕНТРОВ</button>
        <button id="a2b-export">EXPORT A2B RECEIPT</button>
      </div>

      <div class="a2b-primary-grid">
        <article class="a2b-geometry-card">
          <div class="section-head">
            <div><p class="eyebrow">REFERENCE GEOMETRY</p><h2>Конфликтный объём и минимальные envelopes</h2></div>
            <span id="a2b-branch-label"></span>
          </div>
          <canvas id="a2b-geometry" width="1040" height="500" data-testid="a2b-geometry"></canvas>
          <div class="a2b-legend">
            <span class="a2b-source">reference clump A</span>
            <span class="a2b-receiver">reference clump B</span>
            <span class="a2b-conflict">must-leave conflict volume</span>
            <span class="a2b-envelope">minimum full-shell envelope</span>
          </div>
          <p class="a2b-warning">Пунктир не является рассчитанной поверхностью сгустка. Это сферическая оболочка максимальной вместимости, дающая минимально возможный радиальный reach. Реальная локальная выпуклость должна выйти не меньше.</p>
        </article>

        <article class="a2b-ledger-card" data-testid="a2b-ledger">
          <div class="section-head"><div><p class="eyebrow">AMOUNT + GEOMETRY</p><h2>Что уже определяется без закона упругости</h2></div></div>
          <dl>
            <div><dt>Объём одного сгустка V</dt><dd id="a2b-sphere-volume"></dd></div>
            <div><dt>Глубина reference-overlap</dt><dd id="a2b-overlap-depth"></dd></div>
            <div><dt>Конфликтный объём</dt><dd id="a2b-overlap-volume"></dd></div>
            <div><dt>Доля конфликтного объёма</dt><dd id="a2b-overlap-fraction"></dd></div>
            <div><dt>Вывести каждому сгустку</dt><dd id="a2b-displaced-each"></dd></div>
            <div><dt>Доля каждого сгустка</dt><dd id="a2b-displaced-fraction"></dd></div>
            <div><dt>Всего вне reference-union</dt><dd id="a2b-outside-total"></dd></div>
            <div><dt>Минимальный R_out/R</dt><dd id="a2b-outer-radius-ratio"></dd></div>
            <div><dt>Минимальный ΔR/R</dt><dd id="a2b-shell-thickness"></dd></div>
            <div><dt>Amount closure residual</dt><dd id="a2b-closure"></dd></div>
          </dl>
          <div id="a2b-verdict" class="a2b-verdict" data-testid="a2b-verdict"></div>
        </article>
      </div>

      <div class="a2b-chart-card">
        <div class="section-head">
          <div><p class="eyebrow">SEPARATION CORRIDOR</p><h2>Сколько геометрической перестройки неизбежно</h2></div>
          <span>ось X: d/R</span>
        </div>
        <canvas id="a2b-bounds-chart" width="1080" height="430" data-testid="a2b-bounds-chart"></canvas>
        <div class="a2b-legend">
          <span class="a2b-conflict">V_overlap / V</span>
          <span class="a2b-half">V_overlap / 2V per clump</span>
          <span class="a2b-envelope">minimum ΔR / R</span>
        </div>
      </div>

      <div class="a2b-branch-card" data-testid="a2b-branches">
        <div class="section-head"><div><p class="eyebrow">LOGICAL FORK</p><h2>Что может произойти с двумя центрами</h2></div></div>
        <table>
          <thead><tr><th>Ветка</th><th>Содержание</th><th>Статус A2B</th></tr></thead>
          <tbody>
            <tr><td>B1 DISTINCT CLUMPS</td><td>Два связанных центра, disjoint connected domains, сохранение количества, свободная граница</td><td class="pass-text">ACTIVE</td></tr>
            <tr><td>B2 MERGER</td><td>Два центра теряют отдельную идентичность и образуют один объект</td><td>SEPARATE BRANCH</td></tr>
            <tr><td>B3 SHEDDING</td><td>Количество выходит в общий океан поля и должно иметь полный ledger</td><td>OPEN / NOT SELECTED</td></tr>
            <tr><td>B4 COMPRESSION</td><td>Рост локального количества при ещё не достигнутом пределе плотности</td><td>EXCLUDED IN SATURATED CONTROL</td></tr>
          </tbody>
        </table>
      </div>

      <div class="a2b-reference-card" data-testid="a2b-reference-table">
        <div class="section-head"><div><p class="eyebrow">EXACT REFERENCE POINTS</p><h2>Контакт, глубокое сближение и топологический предел</h2></div></div>
        <table>
          <thead><tr><th>Точка</th><th>d/R</th><th>V_overlap/V</th><th>на каждый сгусток</th><th>min ΔR/R</th><th>ветка</th></tr></thead>
          <tbody id="a2b-reference-body"></tbody>
        </table>
      </div>

      <div class="a2b-parity-card" data-testid="a2b-parity">
        <div class="section-head"><div><p class="eyebrow">M0 / M1 / M2</p><h2>Аналитическая линза, численный интеграл и amount ledger</h2></div></div>
        <table><thead><tr><th>Проверка</th><th>Значение</th><th>Допуск</th><th>Статус</th></tr></thead><tbody id="a2b-parity-body"></tbody></table>
      </div>

      <div class="a2b-conclusion" data-testid="a2b-conclusion">
        <strong>A2B interpretation ceiling</strong>
        <p id="a2b-conclusion-text"></p>
        <small>Следующая неизвестная — не объём, а закон свободной границы: куда поле перераспределяется и какой contour это выбирает. До него W1, torque и упор не вычислены.</small>
      </div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class FreeBoundaryBoundsPanel {
  private model: FreeBoundaryModel = { radius: 1, separation: 1.2 };
  private readonly geometryCanvas: HTMLCanvasElement;
  private readonly chartCanvas: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.geometryCanvas = required<HTMLCanvasElement>(root, "#a2b-geometry");
    this.chartCanvas = required<HTMLCanvasElement>(root, "#a2b-bounds-chart");
    this.bind();
    this.render();
  }

  private bind(): void {
    const separation = required<HTMLInputElement>(this.root, "#a2b-separation");
    const update = () => {
      this.model = { ...this.model, separation: Number(separation.value) * this.model.radius };
      this.render();
    };
    separation.addEventListener("input", update);
    const set = (ratio: number) => {
      separation.value = ratio.toFixed(6);
      update();
    };
    required<HTMLButtonElement>(this.root, "#a2b-contact").addEventListener("click", () => set(2));
    required<HTMLButtonElement>(this.root, "#a2b-default").addEventListener("click", () => set(1.2));
    required<HTMLButtonElement>(this.root, "#a2b-peak").addEventListener("click", () => set(Math.sqrt(3) - 1));
    required<HTMLButtonElement>(this.root, "#a2b-concentric").addEventListener("click", () => set(0));
    required<HTMLButtonElement>(this.root, "#a2b-export").addEventListener("click", () => this.exportReceipt());
  }

  private render(): void {
    const bounds = freeBoundaryBounds(this.model);
    const parity = freeBoundaryParity(this.model);
    const pass = parity.overlapVolumeRelativeError <= 1e-11
      && parity.firstMomentRelativeError <= 1e-11
      && Math.abs(parity.splitLedgerResidual) <= 1e-12
      && Math.abs(parity.amountClosureResidual) <= 1e-12;

    required<HTMLOutputElement>(this.root, "#a2b-separation-value").value = bounds.separationRatio.toFixed(3);
    const status = required<HTMLElement>(this.root, "#a2b-status");
    status.textContent = pass
      ? bounds.branchStatus === "DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER"
        ? "GEOMETRY PASS · IDENTITY BLOCKER"
        : "A2B LOWER BOUNDS PASS"
      : "A2B NUMERICAL BLOCKER";
    status.className = `audit-badge ${pass ? "pass" : "fail"}`;
    required<HTMLElement>(this.root, "#a2b-branch-label").textContent = statusLabel(bounds.branchStatus);

    required<HTMLElement>(this.root, "#a2b-sphere-volume").textContent = format(bounds.sphereVolume);
    required<HTMLElement>(this.root, "#a2b-overlap-depth").textContent = format(bounds.overlapDepth / bounds.radius) + " R";
    required<HTMLElement>(this.root, "#a2b-overlap-volume").textContent = format(bounds.overlapVolume);
    required<HTMLElement>(this.root, "#a2b-overlap-fraction").textContent = format(bounds.overlapFraction);
    required<HTMLElement>(this.root, "#a2b-displaced-each").textContent = format(bounds.displacedVolumePerClump);
    required<HTMLElement>(this.root, "#a2b-displaced-fraction").textContent = format(bounds.displacedFractionPerClump);
    required<HTMLElement>(this.root, "#a2b-outside-total").textContent = format(bounds.requiredOutsideReferenceUnion);
    required<HTMLElement>(this.root, "#a2b-outer-radius-ratio").textContent = format(bounds.minimumOuterRadiusRatio);
    required<HTMLElement>(this.root, "#a2b-shell-thickness").textContent = format(bounds.minimumShellThicknessRatio);
    required<HTMLElement>(this.root, "#a2b-closure").textContent = format(bounds.amountClosureResidual);

    const verdict = !pass
      ? "Независимый численный интеграл не совпал с аналитической геометрией. Интерпретация остановлена."
      : bounds.branchStatus === "NO_REFERENCE_CONFLICT"
        ? "Reference-профили не пересекаются. Геометрическая потребность в свободной границе равна нулю."
        : bounds.branchStatus === "DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER"
          ? "При совпадении центров объёмная нижняя граница ещё вычисляется, но ветка двух различимых центров теряет геометрический паспорт. Это topology blocker, не состояние диполя."
          : `Каждый сгусток обязан вывести не менее ${format(bounds.displacedVolumePerClump)} объёма из reference-конфликта. Даже идеальная полная оболочка требует reach не меньше ΔR/R=${format(bounds.minimumShellThicknessRatio)}. Реальная форма остаётся constitutive blocker.`;
    required<HTMLElement>(this.root, "#a2b-verdict").textContent = verdict;
    required<HTMLElement>(this.root, "#a2b-conclusion-text").textContent = pass
      ? `${verdict} Геометрия закрыла объём перераспределения, но не выбрала боковую выпуклость, заднюю каверну, neck или другую форму. Поэтому результат: FREE_BOUNDARY_GEOMETRY_LOWER_BOUNDS_PASS / CONSTITUTIVE_LAW_BLOCKER.`
      : verdict;

    this.drawGeometry(bounds);
    this.drawChart();
    this.renderReferenceRows();
    this.renderParity(parity);
  }

  private drawGeometry(bounds: ReturnType<typeof freeBoundaryBounds>): void {
    const canvas = this.geometryCanvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A2B geometry canvas unavailable");
    const R = bounds.radius;
    const d = bounds.separation;
    const Rout = bounds.minimumOuterRadius;
    const minX = -1.35 * Rout;
    const maxX = Math.max(1.35 * Rout, d + 1.35 * Rout);
    const maxY = 1.4 * Rout;
    const scale = Math.min(canvas.width / (maxX - minX), canvas.height / (2 * maxY));
    const xOf = (x: number) => (x - minX) * scale;
    const yOf = (y: number) => canvas.height / 2 - y * scale;

    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(255,255,255,.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, yOf(0));
    context.lineTo(canvas.width, yOf(0));
    context.stroke();

    const drawReference = (cx: number, fill: string, stroke: string) => {
      context.fillStyle = fill;
      context.strokeStyle = stroke;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(xOf(cx), yOf(0), R * scale, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    };
    drawReference(0, "rgba(87,151,255,.20)", "rgba(100,173,255,.96)");
    drawReference(d, "rgba(77,220,171,.18)", "rgba(83,235,180,.96)");

    if (d < 2 * R && d > 0) {
      context.save();
      context.beginPath();
      context.arc(xOf(0), yOf(0), R * scale, 0, 2 * Math.PI);
      context.clip();
      context.fillStyle = "rgba(255,100,83,.72)";
      context.beginPath();
      context.arc(xOf(d), yOf(0), R * scale, 0, 2 * Math.PI);
      context.fill();
      context.restore();
    } else if (d === 0) {
      context.fillStyle = "rgba(255,100,83,.62)";
      context.beginPath();
      context.arc(xOf(0), yOf(0), R * scale, 0, 2 * Math.PI);
      context.fill();
    }

    if (bounds.minimumShellThickness > 0) {
      context.strokeStyle = "rgba(250,220,120,.88)";
      context.lineWidth = 2;
      context.setLineDash([9, 7]);
      for (const cx of [0, d]) {
        context.beginPath();
        context.arc(xOf(cx), yOf(0), Rout * scale, 0, 2 * Math.PI);
        context.stroke();
      }
      context.setLineDash([]);
    }

    context.fillStyle = "rgba(240,246,242,.86)";
    context.font = "13px ui-monospace, monospace";
    context.fillText("A", xOf(0) - 5, yOf(0) + 5);
    context.fillText("B", xOf(d) - 5, yOf(0) + 5);
    if (bounds.overlapVolume > 0) {
      context.fillStyle = "rgba(255,220,190,.95)";
      context.fillText("MUST LEAVE", xOf(d / 2) - 42, yOf(0) - 12);
    }
    if (bounds.branchStatus === "DISTINCT_CENTRE_IDENTITY_TOPOLOGY_BLOCKER") {
      context.fillStyle = "rgba(255,215,120,.96)";
      context.fillText("TWO CENTRE LABELS COINCIDE — B1 BLOCKED", 24, 34);
    }
  }

  private drawChart(): void {
    const canvas = this.chartCanvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A2B chart canvas unavailable");
    const left = 62, right = 24, top = 24, bottom = 50;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    const xOf = (ratio: number) => left + ratio / 2.5 * width;
    const yOf = (value: number) => top + (1 - value) * height;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(255,255,255,.12)";
    context.fillStyle = "rgba(225,238,232,.72)";
    context.font = "12px ui-monospace, monospace";
    for (const y of [0, .25, .5, .75, 1]) {
      context.beginPath(); context.moveTo(left, yOf(y)); context.lineTo(canvas.width - right, yOf(y)); context.stroke();
      context.fillText(y.toFixed(2), 8, yOf(y) + 4);
    }
    for (const x of [0, .5, 1, 1.5, 2, 2.5]) {
      context.beginPath(); context.moveTo(xOf(x), top); context.lineTo(xOf(x), canvas.height - bottom); context.stroke();
      context.fillText(x.toFixed(1), xOf(x) - 10, canvas.height - 20);
    }
    const draw = (valueAt: (bounds: ReturnType<typeof freeBoundaryBounds>) => number, stroke: string, dash: number[] = []) => {
      context.strokeStyle = stroke;
      context.lineWidth = 3;
      context.setLineDash(dash);
      context.beginPath();
      for (let index = 0; index <= 250; index += 1) {
        const ratio = 2.5 * index / 250;
        const bounds = freeBoundaryBounds({ radius: 1, separation: ratio });
        const x = xOf(ratio);
        const y = yOf(valueAt(bounds));
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      context.setLineDash([]);
    };
    draw(bounds => bounds.overlapFraction, "#ff765e");
    draw(bounds => bounds.displacedFractionPerClump, "#f0c968", [8, 5]);
    draw(bounds => bounds.minimumShellThicknessRatio, "#8fe0bd", [3, 4]);
    context.strokeStyle = "rgba(255,255,255,.5)";
    context.setLineDash([5, 6]);
    context.beginPath(); context.moveTo(xOf(2), top); context.lineTo(xOf(2), canvas.height - bottom); context.stroke();
    context.setLineDash([]);
  }

  private renderReferenceRows(): void {
    required<HTMLElement>(this.root, "#a2b-reference-body").innerHTML = referenceRows().map(row => `
      <tr>
        <td>${row.label}</td>
        <td>${format(row.separationRatio)}</td>
        <td>${format(row.overlapFraction)}</td>
        <td>${format(row.displacedFractionPerClump)}</td>
        <td>${format(row.minimumShellThicknessRatio)}</td>
        <td>${statusLabel(row.branchStatus)}</td>
      </tr>
    `).join("");
  }

  private renderParity(parity: ReturnType<typeof freeBoundaryParity>): void {
    const rows = [
      ["M1 overlap volume", parity.overlapVolumeRelativeError, 1e-11],
      ["M1 overlap first moment", parity.firstMomentRelativeError, 1e-11],
      ["M2 equal split ledger", Math.abs(parity.splitLedgerResidual), 1e-12],
      ["M2 total amount closure", Math.abs(parity.amountClosureResidual), 1e-12],
    ] as const;
    required<HTMLElement>(this.root, "#a2b-parity-body").innerHTML = rows.map(([label, value, threshold]) => `
      <tr><td>${label}</td><td>${format(value)}</td><td>≤ ${threshold}</td><td class="${value <= threshold ? "pass-text" : "fail-text"}">${value <= threshold ? "PASS" : "FAIL"}</td></tr>
    `).join("");
  }

  private exportReceipt(): void {
    const bounds = freeBoundaryBounds(this.model);
    const parity = freeBoundaryParity(this.model);
    const receipt = {
      schema: "VOXELLAB_ACTION_TRANSPORT_A2B_FREE_BOUNDARY_BOUNDS_RECEIPT_V1",
      commit: APP_COMMIT,
      model: this.model,
      bounds,
      parity,
      referenceRows: referenceRows(),
      logicalDelta: "LD_A2_OVERLAP_LENS_IS_DISPLACEMENT_DEMAND_NOT_SHARED_PHYSICAL_DOMAIN",
      verdict: parity.overlapVolumeRelativeError <= 1e-11
        && parity.firstMomentRelativeError <= 1e-11
        ? "A2B_FREE_BOUNDARY_GEOMETRY_LOWER_BOUNDS_PASS_CONSTITUTIVE_LAW_BLOCKER"
        : "A2B_NUMERICAL_OR_PROVENANCE_BLOCKER",
      firewalls: [
        "NO_SHARED_PHYSICAL_DOUBLE_OCCUPANCY",
        "NO_ARBITRARY_COMPENSATION_SOURCE",
        "NO_DEFORMED_CONTOUR_AS_SOLVED",
        "NO_PHYSICAL_FORCE",
        "NO_UPOR_CLAIM",
        "NO_DIPOLE_VALIDATION",
        "NO_SCALE_BINDING",
        "NO_VALIDATION",
      ],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "VOXELLAB_ACTION_TRANSPORT_A2B_FREE_BOUNDARY_BOUNDS_RECEIPT.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
