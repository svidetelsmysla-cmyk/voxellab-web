import {
  DUAL_MEMBERSHIP_PEAK_NORMALIZED,
  DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO,
  cubatureOverlap,
  exactDualMembershipNetMagnitude,
  localOverlapChannels,
  normalizedDualMembershipCurve,
  overlapContactReference,
  overlapLedger,
  overlapParity,
  shellIntegratedOverlap,
  type EqualSphereOverlapModel,
} from "./overlapGeometry";
import type { Vec3 } from "./math";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

type MapChannel = "MEMBERSHIP" | "DUAL_NET" | "DIRECT" | "BACKGROUND";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing A2 element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e5) return value.toExponential(5);
  return value.toFixed(7);
}

function norm(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function template(): string {
  return `
    <section class="overlap-a2 card" data-testid="overlap-a2-panel">
      <div class="section-head overlap-a2-head">
        <div>
          <p class="eyebrow">A2 · CONTACT / OVERLAP GEOMETRY</p>
          <h2>Перекрытие двух сгустков без придуманного контактного закона</h2>
          <p>Равные сферы, κ=1. Сначала вычисляется точная геометрия общей области. Затем раздельно показываются наивный dual-membership control и governed unified occupied-domain ledger.</p>
        </div>
        <span id="a2-status" class="audit-badge pass">RUNNING A2</span>
      </div>

      <div class="a2-controls">
        <label>Разделение центров d/R
          <input id="a2-separation" type="range" min="0" max="2.5" step="0.01" value="1.20">
        </label>
        <output id="a2-separation-value">1.20</output>
        <label>Карта
          <select id="a2-map-channel">
            <option value="MEMBERSHIP">occupied-domain membership</option>
            <option value="DUAL_NET">dual-membership net control</option>
            <option value="DIRECT">direct body-associated channel</option>
            <option value="BACKGROUND">external background residual</option>
          </select>
        </label>
        <button id="a2-concentric">СОВПАДЕНИЕ d=0</button>
        <button id="a2-peak">ТОЧНЫЙ ПИК CONTROL</button>
        <button id="a2-contact">КАСАНИЕ d=2R</button>
        <button id="a2-separated">РАЗНЕСТИ d=2.3R</button>
        <button id="a2-export">EXPORT A2 RECEIPT</button>
      </div>

      <div class="a2-lane-grid">
        <article>
          <strong>DUAL-MEMBERSHIP CONTROL</strong>
          <p>Общая область продолжает считаться частью обоих тел. Это вычислимый геометрический контроль, но он дважды назначает один occupied volume двум объектам.</p>
        </article>
        <article>
          <strong>GOVERNED UNIFIED DOMAIN</strong>
          <p>Общая область учитывается один раз. Избыточное количество равно overlap volume и уходит в отдельный positive compensation ledger. Его размещение не придумано.</p>
        </article>
      </div>

      <div class="a2-map-grid">
        <article class="a2-map-card">
          <div class="section-head"><div><p class="eyebrow">ГЕОМЕТРИЯ</p><h2>Source, receiver и shared occupied-domain</h2></div><span id="a2-map-label"></span></div>
          <canvas id="a2-overlap-map" width="980" height="460" data-testid="a2-overlap-map"></canvas>
          <p>Штрихованная линза — общая область. В governed lane она не принадлежит двум независимым телам одновременно. Compensation amount показан в ledger, но не размещён в пространстве.</p>
        </article>
        <article class="a2-ledger-card" data-testid="a2-ledger">
          <div class="section-head"><div><p class="eyebrow">AMOUNT LEDGER</p><h2>Без двойного счёта количества</h2></div></div>
          <dl>
            <div><dt>Volume одной сферы</dt><dd id="a2-sphere-volume"></dd></div>
            <div><dt>Overlap volume</dt><dd id="a2-overlap-volume"></dd></div>
            <div><dt>Union occupied volume</dt><dd id="a2-union-volume"></dd></div>
            <div><dt>Positive compensation amount</dt><dd id="a2-compensation"></dd></div>
            <div><dt>Union + compensation − 2V</dt><dd id="a2-closure"></dd></div>
            <div><dt>Dual-membership net control</dt><dd id="a2-dual-net"></dd></div>
            <div><dt>Unified exclusive resolved net</dt><dd id="a2-unified-net"></dd></div>
            <div><dt>Full governed result</dt><dd id="a2-full-result"></dd></div>
          </dl>
        </article>
      </div>

      <div class="a2-chart-grid">
        <article class="a2-chart-card">
          <div class="section-head"><div><p class="eyebrow">НАПРАВЛЕННЫЕ ВЕТВИ</p><h2>Direct, background и dual-membership net</h2></div><span>нормировка на exterior contact reference</span></div>
          <canvas id="a2-w1-chart" width="900" height="420" data-testid="a2-w1-chart"></canvas>
          <div class="a2-legend"><span class="a2-direct">direct</span><span class="a2-background">background</span><span class="a2-net">dual net</span><span class="a2-zero">unified resolved = 0</span></div>
        </article>
        <article class="a2-chart-card">
          <div class="section-head"><div><p class="eyebrow">ГЕОМЕТРИЧЕСКИЙ LEDGER</p><h2>Overlap и compensation fraction</h2></div><span>от объёма одной сферы</span></div>
          <canvas id="a2-volume-chart" width="900" height="420" data-testid="a2-volume-chart"></canvas>
          <div class="a2-legend"><span class="a2-overlap">overlap fraction</span><span class="a2-comp">compensation fraction</span></div>
        </article>
      </div>

      <div class="a2-parity-card" data-testid="a2-parity">
        <div class="section-head"><div><p class="eyebrow">M0 / M1 / M2</p><h2>Точная линза, curved-shell и 3D cubature</h2></div></div>
        <table><thead><tr><th>Проверка</th><th>Значение</th><th>Допуск</th><th>Статус</th></tr></thead><tbody id="a2-parity-body"></tbody></table>
      </div>

      <div class="a2-conclusion" data-testid="a2-conclusion">
        <strong>A2 verdict</strong>
        <p id="a2-conclusion-text"></p>
        <small>Opaque first-hit применяется только к внешнему фону. Direct-канал считается отдельно. Dual-membership bump не повышается до физического упора.</small>
      </div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class OverlapGeometryPanel {
  private model: EqualSphereOverlapModel = {
    radius: 1,
    separation: 1.2,
    backgroundIntensityPerSteradian: 1,
    receiverDensity: 1,
  };
  private channel: MapChannel = "MEMBERSHIP";
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly w1Canvas: HTMLCanvasElement;
  private readonly volumeCanvas: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.mapCanvas = required<HTMLCanvasElement>(root, "#a2-overlap-map");
    this.w1Canvas = required<HTMLCanvasElement>(root, "#a2-w1-chart");
    this.volumeCanvas = required<HTMLCanvasElement>(root, "#a2-volume-chart");
    this.bind();
    this.render();
  }

  private bind(): void {
    const separation = required<HTMLInputElement>(this.root, "#a2-separation");
    const channel = required<HTMLSelectElement>(this.root, "#a2-map-channel");
    const update = () => {
      this.model = { ...this.model, separation: Number(separation.value) * this.model.radius };
      this.channel = channel.value as MapChannel;
      this.render();
    };
    separation.addEventListener("input", update);
    channel.addEventListener("input", update);
    const set = (ratio: number) => {
      separation.value = ratio.toFixed(5);
      update();
    };
    required<HTMLButtonElement>(this.root, "#a2-concentric").addEventListener("click", () => set(0));
    required<HTMLButtonElement>(this.root, "#a2-peak").addEventListener("click", () => set(DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO));
    required<HTMLButtonElement>(this.root, "#a2-contact").addEventListener("click", () => set(2));
    required<HTMLButtonElement>(this.root, "#a2-separated").addEventListener("click", () => set(2.3));
    required<HTMLButtonElement>(this.root, "#a2-export").addEventListener("click", () => this.exportReceipt());
  }

  private render(): void {
    const ratio = this.model.separation / this.model.radius;
    required<HTMLOutputElement>(this.root, "#a2-separation-value").value = ratio.toFixed(3);
    const ledger = overlapLedger(this.model);
    const shell = shellIntegratedOverlap(this.model);
    const parity = overlapParity(this.model);
    const overlapActive = ledger.overlapVolume > 1e-12;
    const exact = exactDualMembershipNetMagnitude(this.model);
    const pass = parity.shellRelativeError <= 1e-10
      && parity.cubatureRelativeError <= 8e-3
      && parity.overlapVolumeRelativeError <= 8e-3
      && parity.overlapFirstMomentRelativeError <= 1.2e-2
      && parity.normalizedTorque <= 8e-3;
    const status = required<HTMLElement>(this.root, "#a2-status");
    status.textContent = pass ? "A2 GEOMETRY PARITY PASS" : "A2 NUMERICAL BLOCKER";
    status.className = `audit-badge ${pass ? "pass" : "fail"}`;

    required<HTMLElement>(this.root, "#a2-sphere-volume").textContent = format(ledger.sphereVolume);
    required<HTMLElement>(this.root, "#a2-overlap-volume").textContent = format(ledger.overlapVolume);
    required<HTMLElement>(this.root, "#a2-union-volume").textContent = format(ledger.unionOccupiedVolume);
    required<HTMLElement>(this.root, "#a2-compensation").textContent = format(ledger.compensationAmount);
    required<HTMLElement>(this.root, "#a2-closure").textContent = format(ledger.amountClosureResidual);
    required<HTMLElement>(this.root, "#a2-dual-net").textContent = format(exact);
    required<HTMLElement>(this.root, "#a2-unified-net").textContent = "0 · exclusive domain only";
    required<HTMLElement>(this.root, "#a2-full-result").textContent = overlapActive
      ? "BLOCKED · compensation placement / shared ownership"
      : "0 · no overlap in matched κ=1 control";

    const conclusion = pass
      ? overlapActive
        ? `Наивный dual-membership control даёт ненулевой горб, потому что shared volume одновременно считается source и receiver. Governed union-domain сохраняет количество: overlap=${format(ledger.overlapVolume)} переносится в positive compensation ledger. Пока не задано, где это количество размещается и кому принадлежит shared domain, полный двухтельный residual не определён.`
        : "Вне перекрытия A1-результат сохраняется: direct и background сокращаются. Overlap и compensation равны нулю."
      : "M0/M1/M2 не прошли замороженный численный corridor. Интерпретация остановлена.";
    required<HTMLElement>(this.root, "#a2-conclusion-text").textContent = conclusion;

    this.drawMap();
    this.drawW1Chart();
    this.drawVolumeChart();
    this.renderParity(parity, shell.dualMembershipNetW1[0]);
  }

  private drawMap(): void {
    const canvas = this.mapCanvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A2 map canvas unavailable");
    const R = this.model.radius;
    const d = this.model.separation;
    const minX = -1.2 * R;
    const maxX = Math.max(1.2 * R, d + 1.2 * R);
    const maxY = 1.25 * R;
    const xOf = (x: number) => (x - minX) / (maxX - minX) * canvas.width;
    const yOf = (y: number) => canvas.height * (0.5 - y / (2 * maxY));
    const worldPerPixelX = (maxX - minX) / canvas.width;
    const worldPerPixelY = 2 * maxY / canvas.height;
    context.fillStyle = "#06100f";
    context.fillRect(0, 0, canvas.width, canvas.height);

    let maxMagnitude = 0;
    if (this.channel !== "MEMBERSHIP") {
      for (let py = 0; py < canvas.height; py += 6) {
        for (let px = 0; px < canvas.width; px += 6) {
          const point: Vec3 = [minX + px * worldPerPixelX, maxY - py * worldPerPixelY, 0];
          const sample = localOverlapChannels(point, this.model);
          if (!sample.insideReceiver) continue;
          const vector = this.channel === "DIRECT" ? sample.direct
            : this.channel === "BACKGROUND" ? sample.background
              : sample.dualMembershipNet;
          maxMagnitude = Math.max(maxMagnitude, norm(vector));
        }
      }
    }
    maxMagnitude = Math.max(maxMagnitude, 1e-12);

    for (let py = 0; py < canvas.height; py += 3) {
      for (let px = 0; px < canvas.width; px += 3) {
        const point: Vec3 = [minX + px * worldPerPixelX, maxY - py * worldPerPixelY, 0];
        const sample = localOverlapChannels(point, this.model);
        if (sample.membership === "OUTSIDE") continue;
        let fill: string;
        if (this.channel === "MEMBERSHIP") {
          fill = sample.membership === "SHARED_OCCUPIED" ? "rgba(239,194,92,0.92)"
            : sample.membership === "SOURCE_ONLY" ? "rgba(91,158,255,0.54)"
              : "rgba(75,220,173,0.54)";
        } else {
          const vector = this.channel === "DIRECT" ? sample.direct
            : this.channel === "BACKGROUND" ? sample.background
              : sample.dualMembershipNet;
          const t = Math.min(1, norm(vector) / maxMagnitude);
          fill = this.channel === "BACKGROUND"
            ? `rgba(95,165,255,${0.12 + 0.78 * t})`
            : `rgba(238,103,78,${0.12 + 0.78 * t})`;
        }
        context.fillStyle = fill;
        context.fillRect(px, py, 4, 4);
      }
    }

    context.lineWidth = 3;
    context.strokeStyle = "rgba(112,177,255,0.95)";
    context.beginPath();
    context.arc(xOf(0), yOf(0), R / (maxX - minX) * canvas.width, 0, 2 * Math.PI);
    context.stroke();
    context.strokeStyle = "rgba(90,238,183,0.95)";
    context.beginPath();
    context.arc(xOf(d), yOf(0), R / (maxX - minX) * canvas.width, 0, 2 * Math.PI);
    context.stroke();

    context.strokeStyle = "rgba(255,224,132,0.8)";
    context.setLineDash([6, 5]);
    for (let py = 0; py < canvas.height; py += 12) {
      for (let px = 0; px < canvas.width; px += 12) {
        const point: Vec3 = [minX + px * worldPerPixelX, maxY - py * worldPerPixelY, 0];
        if (localOverlapChannels(point, this.model).membership !== "SHARED_OCCUPIED") continue;
        context.beginPath();
        context.moveTo(px - 5, py + 5);
        context.lineTo(px + 5, py - 5);
        context.stroke();
      }
    }
    context.setLineDash([]);

    if (this.channel !== "MEMBERSHIP") {
      context.strokeStyle = "rgba(255,255,255,0.76)";
      context.fillStyle = "rgba(255,255,255,0.76)";
      for (let py = 30; py < canvas.height - 20; py += 40) {
        for (let px = 30; px < canvas.width - 20; px += 40) {
          const point: Vec3 = [minX + px * worldPerPixelX, maxY - py * worldPerPixelY, 0];
          const sample = localOverlapChannels(point, this.model);
          if (!sample.insideReceiver) continue;
          const vector = this.channel === "DIRECT" ? sample.direct
            : this.channel === "BACKGROUND" ? sample.background
              : sample.dualMembershipNet;
          const magnitude = norm(vector);
          if (magnitude < 1e-10) continue;
          const length = 18 * Math.min(1, magnitude / maxMagnitude);
          const dx = length * vector[0] / magnitude;
          const dy = -length * vector[1] / magnitude;
          context.beginPath();
          context.moveTo(px, py);
          context.lineTo(px + dx, py + dy);
          context.stroke();
        }
      }
    }

    const label = this.channel === "MEMBERSHIP" ? "blue source · green receiver · amber shared"
      : this.channel === "DUAL_NET" ? "diagnostic dual-membership net"
        : this.channel === "DIRECT" ? "direct body-associated channel"
          : "opaque external-background residual";
    required<HTMLElement>(this.root, "#a2-map-label").textContent = label;
  }

  private drawW1Chart(): void {
    const canvas = this.w1Canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A2 W1 canvas unavailable");
    const left = 58, right = 24, top = 24, bottom = 48;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const xOf = (ratio: number) => left + ratio / 2.5 * width;
    const yOf = (value: number) => top + (1.4 - value) / 2.8 * height;
    context.strokeStyle = "rgba(255,255,255,0.12)";
    context.fillStyle = "rgba(225,238,232,0.72)";
    context.font = "12px ui-monospace, monospace";
    for (const y of [-1, -0.5, 0, 0.5, 1]) {
      context.beginPath(); context.moveTo(left, yOf(y)); context.lineTo(canvas.width - right, yOf(y)); context.stroke();
      context.fillText(y.toFixed(1), 8, yOf(y) + 4);
    }
    for (const x of [0, 0.5, 1, 1.5, 2, 2.5]) {
      context.beginPath(); context.moveTo(xOf(x), top); context.lineTo(xOf(x), canvas.height - bottom); context.stroke();
      context.fillText(`${x.toFixed(1)}R`, xOf(x) - 14, canvas.height - 20);
    }
    const draw = (selector: (sample: { direct: number; background: number; net: number }) => number, stroke: string, dashed = false) => {
      context.strokeStyle = stroke; context.lineWidth = 2.5; context.setLineDash(dashed ? [7, 5] : []); context.beginPath();
      for (let index = 0; index <= 125; index += 1) {
        const ratio = 2.5 * index / 125;
        const sampleModel = { ...this.model, separation: ratio * this.model.radius };
        const shell = shellIntegratedOverlap(sampleModel, 48);
        const reference = overlapContactReference(sampleModel);
        const sample = {
          direct: shell.directW1[0] / reference,
          background: shell.backgroundW1[0] / reference,
          net: shell.dualMembershipNetW1[0] / reference,
        };
        const x = xOf(ratio), y = yOf(selector(sample));
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke(); context.setLineDash([]);
    };
    draw(sample => sample.direct, "#f08062");
    draw(sample => sample.background, "#6da8ff");
    draw(sample => sample.net, "#f0d172");
    context.strokeStyle = "rgba(118,238,190,0.9)"; context.lineWidth = 2; context.setLineDash([4, 5]);
    context.beginPath(); context.moveTo(left, yOf(0)); context.lineTo(canvas.width - right, yOf(0)); context.stroke(); context.setLineDash([]);
    context.strokeStyle = "rgba(255,216,117,0.9)"; context.setLineDash([6, 5]);
    context.beginPath(); context.moveTo(xOf(DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO), top); context.lineTo(xOf(DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO), canvas.height - bottom); context.stroke(); context.setLineDash([]);
  }

  private drawVolumeChart(): void {
    const canvas = this.volumeCanvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A2 volume canvas unavailable");
    const left = 58, right = 24, top = 24, bottom = 48;
    const width = canvas.width - left - right;
    const height = canvas.height - top - bottom;
    context.fillStyle = "#07100f"; context.fillRect(0, 0, canvas.width, canvas.height);
    const xOf = (ratio: number) => left + ratio / 2.5 * width;
    const yOf = (value: number) => top + (1 - value) * height;
    context.strokeStyle = "rgba(255,255,255,0.12)"; context.fillStyle = "rgba(225,238,232,0.72)"; context.font = "12px ui-monospace, monospace";
    for (const y of [0, 0.25, 0.5, 0.75, 1]) {
      context.beginPath(); context.moveTo(left, yOf(y)); context.lineTo(canvas.width - right, yOf(y)); context.stroke(); context.fillText(y.toFixed(2), 6, yOf(y) + 4);
    }
    for (const x of [0, 0.5, 1, 1.5, 2, 2.5]) {
      context.beginPath(); context.moveTo(xOf(x), top); context.lineTo(xOf(x), canvas.height - bottom); context.stroke(); context.fillText(`${x.toFixed(1)}R`, xOf(x) - 14, canvas.height - 20);
    }
    const draw = (stroke: string, dash: boolean) => {
      context.strokeStyle = stroke; context.lineWidth = 3; context.setLineDash(dash ? [8, 5] : []); context.beginPath();
      for (let index = 0; index <= 200; index += 1) {
        const ratio = 2.5 * index / 200;
        const ledger = overlapLedger({ ...this.model, separation: ratio * this.model.radius });
        const fraction = ledger.overlapVolume / ledger.sphereVolume;
        const x = xOf(ratio), y = yOf(fraction);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke(); context.setLineDash([]);
    };
    draw("#e7b957", false);
    draw("#ef7f67", true);
  }

  private renderParity(parity: ReturnType<typeof overlapParity>, shellSigned: number): void {
    const rows = [
      ["M1 exact-lens net", parity.shellRelativeError, 1e-10],
      ["M2 net", parity.cubatureRelativeError, 8e-3],
      ["M2 overlap volume", parity.overlapVolumeRelativeError, 8e-3],
      ["M2 overlap first moment", parity.overlapFirstMomentRelativeError, 1.2e-2],
      ["M2 normalized torque", parity.normalizedTorque, 8e-3],
    ] as const;
    required<HTMLElement>(this.root, "#a2-parity-body").innerHTML = rows.map(([label, value, threshold]) => `
      <tr><td>${label}</td><td>${format(value)}</td><td>≤ ${threshold}</td><td class="${value <= threshold ? "pass-text" : "fail-text"}">${value <= threshold ? "PASS" : "FAIL"}</td></tr>
    `).join("") + `<tr><td>M1 signed net</td><td>${format(shellSigned)}</td><td>diagnostic</td><td>INFO</td></tr>`;
  }

  private exportReceipt(): void {
    const ledger = overlapLedger(this.model);
    const shell = shellIntegratedOverlap(this.model);
    const cubature = cubatureOverlap(this.model);
    const parity = overlapParity(this.model);
    const receipt = {
      schema: "VOXELLAB_ACTION_TRANSPORT_A2_OVERLAP_RECEIPT_V1",
      commit: APP_COMMIT,
      model: this.model,
      exact: {
        overlapLedger: ledger,
        dualMembershipNet: exactDualMembershipNetMagnitude(this.model),
        normalizedCurve: normalizedDualMembershipCurve(this.model.separation / this.model.radius),
        peakSeparationRatio: DUAL_MEMBERSHIP_PEAK_SEPARATION_RATIO,
        peakNormalized: DUAL_MEMBERSHIP_PEAK_NORMALIZED,
      },
      shell,
      cubature,
      parity,
      governed: {
        unifiedExclusiveResolvedNet: [0, 0, 0],
        compensationAmount: ledger.compensationAmount * this.model.receiverDensity,
        fullResult: ledger.overlapVolume > 0 ? "OVERLAP_COMPENSATION_PLACEMENT_BLOCKER" : "MATCHED_NO_OVERLAP_ZERO",
      },
      firewalls: [
        "DUAL_MEMBERSHIP_CONTROL_NOT_PHYSICAL_UPOR",
        "NO_DOUBLE_OCCUPANCY_AS_PHYSICAL_AMOUNT",
        "NO_COMPENSATION_PLACEMENT_INVENTED",
        "NO_PHYSICAL_FORCE",
        "NO_VALIDATION",
        "NO_CANON_PROMOTION",
      ],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "VOXELLAB_ACTION_TRANSPORT_A2_OVERLAP_RECEIPT.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
