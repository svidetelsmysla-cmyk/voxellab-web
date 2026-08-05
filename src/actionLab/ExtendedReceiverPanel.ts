import {
  analyticExtendedReceiver,
  extendedReceiverParity,
  localExtendedReceiverChannels,
  norm,
  receiverAmount,
  shellIntegratedExtendedReceiver,
  sourceCoefficient,
  type ExtendedReceiverModel,
} from "./extendedReceiver";
import type { Vec3 } from "./math";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

type MapChannel = "DIRECT" | "BACKGROUND" | "NET" | "W0_DIFFERENCE";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing A1 element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-5 || Math.abs(value) >= 1e5) return value.toExponential(5);
  return value.toFixed(7);
}

function template(): string {
  return `
    <section class="extended-a1 card" data-testid="extended-a1-panel">
      <div class="section-head extended-a1-head">
        <div>
          <p class="eyebrow">A1 · TWO-BODY EXTENDED RECEIVER</p>
          <h2>Источник, экран и протяжённый приёмник</h2>
          <p>Каждая точка второго тела принимает локальные source/background каналы. Затем карта честно интегрируется по всему объёму — отдельно в W0, результирующий W1 и torque.</p>
        </div>
        <span id="a1-status" class="audit-badge pass">RUNNING PARITY</span>
      </div>

      <div class="a1-controls">
        <label>Радиус приёмника Rr/Rs
          <input id="a1-receiver-radius" type="range" min="0.2" max="1.2" step="0.05" value="0.70">
        </label>
        <output id="a1-receiver-radius-value">0.70</output>
        <label>Зазор между поверхностями g/Rs
          <input id="a1-gap" type="range" min="0" max="4" step="0.05" value="0.20">
        </label>
        <output id="a1-gap-value">0.20</output>
        <label>Плотность участия приёмника qr
          <input id="a1-receiver-density" type="range" min="0.2" max="2" step="0.1" value="1">
        </label>
        <output id="a1-receiver-density-value">1.00</output>
        <label>Прямой коэффициент κ
          <input id="a1-kappa" type="range" min="0" max="1.6" step="0.05" value="1">
        </label>
        <output id="a1-kappa-value">1.00</output>
        <label>Карта приёмника
          <select id="a1-map-channel">
            <option value="DIRECT">direct W1</option>
            <option value="BACKGROUND">background residual W1</option>
            <option value="NET">net W1</option>
            <option value="W0_DIFFERENCE">W0 deficit − W0 body</option>
          </select>
        </label>
        <button id="a1-contact">КАСАНИЕ g=0</button>
        <button id="a1-reset">СБРОС A1</button>
        <button id="a1-export">EXPORT A1 RECEIPT</button>
      </div>

      <div class="a1-map-grid">
        <article class="a1-map-card">
          <div class="section-head"><div><p class="eyebrow">ЛОКАЛЬНАЯ КАРТА</p><h2>Что принимает каждая часть второго тела</h2></div><span id="a1-map-label"></span></div>
          <canvas id="a1-receiver-map" width="980" height="440" data-testid="a1-receiver-map"></canvas>
          <p>Источник слева. Цвет и стрелки относятся только к выбранному каналу внутри протяжённого приёмника. Никакого сведения к центру масс на этом слое нет.</p>
        </article>

        <article class="a1-map-card a1-ledger-card" data-testid="a1-readout">
          <div class="section-head"><div><p class="eyebrow">ОБЪЁМНЫЙ READOUT</p><h2>После интегрирования приёмника</h2></div></div>
          <dl class="a1-readout-list">
            <div><dt>Разделение центров d/Rs</dt><dd id="a1-separation"></dd></div>
            <div><dt>Количество приёмника Nr</dt><dd id="a1-receiver-amount"></dd></div>
            <div><dt>∫receiver W0 body dV</dt><dd id="a1-body-w0"></dd></div>
            <div><dt>∫receiver W0 deficit dV</dt><dd id="a1-deficit-w0"></dd></div>
            <div><dt>Direct resultant W1x</dt><dd id="a1-direct-w1"></dd></div>
            <div><dt>Background resultant W1x</dt><dd id="a1-background-w1"></dd></div>
            <div><dt>Net resultant W1x</dt><dd id="a1-net-w1"></dd></div>
            <div><dt>|Torque| cubature</dt><dd id="a1-torque"></dd></div>
          </dl>
          <div id="a1-verdict" class="a1-verdict" data-testid="a1-verdict"></div>
        </article>
      </div>

      <div class="a1-chart-grid">
        <article class="a1-chart-card">
          <div class="section-head"><div><p class="eyebrow">СКАЛЯРНАЯ ЗАГРУЗКА</p><h2>Интегральные W0 по всему приёмнику</h2></div><span>по зазору g</span></div>
          <canvas id="a1-w0-chart" width="820" height="390" data-testid="a1-w0-chart"></canvas>
          <div class="a1-legend"><span class="a1-c-body">body W0</span><span class="a1-c-deficit">background deficit W0</span><span class="a1-c-difference">difference</span></div>
        </article>
        <article class="a1-chart-card">
          <div class="section-head"><div><p class="eyebrow">НАПРАВЛЕННЫЙ ИТОГ</p><h2>Direct, background и net W1</h2></div><span>наружу + / к источнику −</span></div>
          <canvas id="a1-w1-chart" width="820" height="390" data-testid="a1-w1-chart"></canvas>
          <div class="a1-legend"><span class="a1-c-direct">direct</span><span class="a1-c-background">background</span><span class="a1-c-net">net</span></div>
        </article>
      </div>

      <div class="a1-parity-card" data-testid="a1-parity">
        <div class="section-head"><div><p class="eyebrow">M0 / M1 / M2</p><h2>Независимая проверка объёмного интеграла</h2></div><span>analytic · curved-shell · 3D cubature</span></div>
        <table>
          <thead><tr><th>Проверка</th><th>Значение</th><th>Допуск</th><th>Статус</th></tr></thead>
          <tbody id="a1-parity-body"></tbody>
        </table>
      </div>

      <div class="a1-conclusion" data-testid="a1-conclusion">
        <strong>Граница A1</strong>
        <p id="a1-conclusion-text"></p>
        <small>В A1 сферы не перекрываются. Частичная прозрачность, redirection, contact deformation и overlap принадлежат следующим gates.</small>
      </div>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class ExtendedReceiverPanel {
  private model: ExtendedReceiverModel = {
    sourceRadius: 1,
    receiverRadius: 0.7,
    separation: 1.9,
    backgroundIntensityPerSteradian: 1,
    sourceToMatchedRatio: 1,
    receiverDensity: 1,
  };

  private channel: MapChannel = "DIRECT";
  private readonly mapCanvas: HTMLCanvasElement;
  private readonly w0Canvas: HTMLCanvasElement;
  private readonly w1Canvas: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
    this.mapCanvas = required<HTMLCanvasElement>(root, "#a1-receiver-map");
    this.w0Canvas = required<HTMLCanvasElement>(root, "#a1-w0-chart");
    this.w1Canvas = required<HTMLCanvasElement>(root, "#a1-w1-chart");
    this.bind();
    this.render();
  }

  private bind(): void {
    const receiverRadius = required<HTMLInputElement>(this.root, "#a1-receiver-radius");
    const gap = required<HTMLInputElement>(this.root, "#a1-gap");
    const density = required<HTMLInputElement>(this.root, "#a1-receiver-density");
    const kappa = required<HTMLInputElement>(this.root, "#a1-kappa");
    const mapChannel = required<HTMLSelectElement>(this.root, "#a1-map-channel");
    const update = () => {
      const radius = Number(receiverRadius.value);
      this.model = {
        ...this.model,
        receiverRadius: radius,
        separation: this.model.sourceRadius + radius + Number(gap.value),
        receiverDensity: Number(density.value),
        sourceToMatchedRatio: Number(kappa.value),
      };
      this.channel = mapChannel.value as MapChannel;
      this.render();
    };
    for (const input of [receiverRadius, gap, density, kappa, mapChannel]) input.addEventListener("input", update);
    required<HTMLButtonElement>(this.root, "#a1-contact").addEventListener("click", () => {
      gap.value = "0";
      update();
    });
    required<HTMLButtonElement>(this.root, "#a1-reset").addEventListener("click", () => {
      receiverRadius.value = "0.7";
      gap.value = "0.2";
      density.value = "1";
      kappa.value = "1";
      mapChannel.value = "DIRECT";
      update();
    });
    required<HTMLButtonElement>(this.root, "#a1-export").addEventListener("click", () => this.exportReceipt());
  }

  private render(): void {
    required<HTMLOutputElement>(this.root, "#a1-receiver-radius-value").value = this.model.receiverRadius.toFixed(2);
    required<HTMLOutputElement>(this.root, "#a1-gap-value").value = (this.model.separation - this.model.sourceRadius - this.model.receiverRadius).toFixed(2);
    required<HTMLOutputElement>(this.root, "#a1-receiver-density-value").value = this.model.receiverDensity.toFixed(2);
    required<HTMLOutputElement>(this.root, "#a1-kappa-value").value = this.model.sourceToMatchedRatio.toFixed(2);

    const shell = shellIntegratedExtendedReceiver(this.model);
    const analytic = analyticExtendedReceiver(this.model);
    const parity = extendedReceiverParity(this.model);
    const pass = parity.shellDirectRelativeError <= 1e-11
      && parity.shellBackgroundRelativeError <= 1e-11
      && parity.cubatureDirectRelativeError <= 1e-5
      && parity.cubatureBackgroundRelativeError <= 1e-5
      && parity.cubatureBodyW0RelativeError <= 1e-4
      && parity.cubatureDeficitRelativeError <= 1e-4
      && parity.normalizedTorque <= 1e-5;
    const status = required<HTMLElement>(this.root, "#a1-status");
    status.textContent = pass ? "A1 PARITY PASS" : "A1 NUMERICAL BLOCKER";
    status.className = `audit-badge ${pass ? "pass" : "fail"}`;

    required<HTMLElement>(this.root, "#a1-separation").textContent = format(this.model.separation / this.model.sourceRadius);
    required<HTMLElement>(this.root, "#a1-receiver-amount").textContent = format(receiverAmount(this.model));
    required<HTMLElement>(this.root, "#a1-body-w0").textContent = format(shell.bodyW0);
    required<HTMLElement>(this.root, "#a1-deficit-w0").textContent = format(shell.backgroundStraightDeficit);
    required<HTMLElement>(this.root, "#a1-direct-w1").textContent = format(shell.directW1[0]);
    required<HTMLElement>(this.root, "#a1-background-w1").textContent = format(shell.backgroundW1[0]);
    required<HTMLElement>(this.root, "#a1-net-w1").textContent = format(shell.netW1[0]);
    required<HTMLElement>(this.root, "#a1-torque").textContent = format(parity.normalizedTorque);

    const kappa = this.model.sourceToMatchedRatio;
    const verdict = kappa === 1
      ? "При κ=1 direct и background сокращаются не только после интегрирования, а в каждой точке приёмника. Протяжённость сферы сама по себе не создаёт конечного радиуса равновесия."
      : kappa < 1
        ? "При κ<1 внешний residual доминирует в каждой точке и после интегрирования при всех непересекающихся расстояниях."
        : "При κ>1 direct-ветвь доминирует в каждой точке и после интегрирования при всех непересекающихся расстояниях.";
    required<HTMLElement>(this.root, "#a1-verdict").textContent = verdict;
    required<HTMLElement>(this.root, "#a1-conclusion-text").textContent = pass
      ? `${verdict} W0 body и W0 deficit по объёму различаются в ближней зоне, но общий receiver readout W1 остаётся пропорциональным. Следующий возможный источник изменения отношения — partial opacity, redirection либо overlap/contact geometry.`
      : "Три численных маршрута не прошли замороженный corridor. Физическая интерпретация остановлена.";

    this.drawMap();
    this.drawW0Chart();
    this.drawW1Chart();
    this.renderParity(parity, analytic.directW1[0]);
  }

  private drawMap(): void {
    const canvas = this.mapCanvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A1 map canvas unavailable");
    const Rs = this.model.sourceRadius;
    const Rr = this.model.receiverRadius;
    const d = this.model.separation;
    const minX = -1.25 * Rs;
    const maxX = d + 1.25 * Rr;
    const maxY = 1.35 * Math.max(Rs, Rr);
    const xOf = (x: number) => 38 + (x - minX) / (maxX - minX) * (canvas.width - 76);
    const yOf = (y: number) => canvas.height / 2 - y / maxY * (canvas.height * 0.42);
    const pxPerUnit = (canvas.width - 76) / (maxX - minX);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const image = context.createImageData(canvas.width, canvas.height);
    let maxMagnitude = 0;
    const samples: Array<{ x: number; y: number; magnitude: number; vector: Vec3 }> = [];
    for (let py = 0; py < canvas.height; py += 2) {
      const y = (canvas.height / 2 - py) / (canvas.height * 0.42) * maxY;
      for (let px = 0; px < canvas.width; px += 2) {
        const x = minX + (px - 38) / (canvas.width - 76) * (maxX - minX);
        const localX = x - d;
        if (localX ** 2 + y ** 2 > Rr ** 2) continue;
        const channels = localExtendedReceiverChannels([x, y, 0], this.model);
        let vector: Vec3;
        let magnitude: number;
        if (this.channel === "DIRECT") {
          vector = channels.direct;
          magnitude = norm(vector);
        } else if (this.channel === "BACKGROUND") {
          vector = channels.background;
          magnitude = norm(vector);
        } else if (this.channel === "NET") {
          vector = channels.net;
          magnitude = norm(vector);
        } else {
          vector = [0, 0, 0];
          magnitude = Math.abs(channels.deficit - channels.bodyW0);
        }
        samples.push({ x: px, y: py, magnitude, vector });
        maxMagnitude = Math.max(maxMagnitude, magnitude);
      }
    }
    const denominator = Math.max(maxMagnitude, 1e-30);
    for (const sample of samples) {
      const t = Math.sqrt(sample.magnitude / denominator);
      const red = Math.round(18 + 225 * t);
      const green = Math.round(42 + 145 * (1 - Math.abs(t - 0.55)));
      const blue = Math.round(70 + 170 * (1 - t));
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
        const ix = sample.x + dx;
        const iy = sample.y + dy;
        if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) continue;
        const offset = 4 * (iy * canvas.width + ix);
        image.data[offset] = red;
        image.data[offset + 1] = green;
        image.data[offset + 2] = blue;
        image.data[offset + 3] = 230;
      }
    }
    context.putImageData(image, 0, 0);

    context.strokeStyle = "rgba(240,247,242,0.82)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(xOf(0), yOf(0), Rs * pxPerUnit, 0, 2 * Math.PI);
    context.stroke();
    context.beginPath();
    context.arc(xOf(d), yOf(0), Rr * pxPerUnit, 0, 2 * Math.PI);
    context.stroke();
    context.fillStyle = "rgba(230,240,234,0.88)";
    context.font = "13px ui-monospace, monospace";
    context.fillText("SOURCE / SCREEN", xOf(-0.7 * Rs), 24);
    context.fillText("EXTENDED RECEIVER", xOf(d - 0.75 * Rr), 24);

    if (this.channel !== "W0_DIFFERENCE") {
      const spacing = Math.max(0.22, Rr / 4);
      for (let lx = -Rr + spacing / 2; lx < Rr; lx += spacing) {
        for (let ly = -Rr + spacing / 2; ly < Rr; ly += spacing) {
          if (lx ** 2 + ly ** 2 > Rr ** 2) continue;
          const global: Vec3 = [d + lx, ly, 0];
          const channels = localExtendedReceiverChannels(global, this.model);
          const vector = this.channel === "DIRECT" ? channels.direct : this.channel === "BACKGROUND" ? channels.background : channels.net;
          const magnitude = norm(vector);
          if (!(magnitude > 1e-14)) continue;
          const length = 8 + 18 * Math.min(1, magnitude / denominator);
          const ux = vector[0] / magnitude;
          const uy = vector[1] / magnitude;
          const x0 = xOf(global[0]);
          const y0 = yOf(global[1]);
          const x1 = x0 + length * ux;
          const y1 = y0 - length * uy;
          context.strokeStyle = "rgba(255,255,255,0.84)";
          context.lineWidth = 1.2;
          context.beginPath();
          context.moveTo(x0, y0);
          context.lineTo(x1, y1);
          context.stroke();
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x1 - 4 * ux + 2.5 * uy, y1 + 4 * uy + 2.5 * ux);
          context.moveTo(x1, y1);
          context.lineTo(x1 - 4 * ux - 2.5 * uy, y1 + 4 * uy - 2.5 * ux);
          context.stroke();
        }
      }
    }

    const labels: Record<MapChannel, string> = {
      DIRECT: "direct body-associated W1",
      BACKGROUND: "external background residual W1",
      NET: "pointwise direct + background",
      W0_DIFFERENCE: "|W0 deficit − W0 body|",
    };
    required<HTMLElement>(this.root, "#a1-map-label").textContent = labels[this.channel];
  }

  private chartAxes(canvas: HTMLCanvasElement, yMin: number, yMax: number): { left: number; top: number; width: number; height: number } {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A1 chart canvas unavailable");
    const geometry = { left: 62, top: 24, width: canvas.width - 86, height: canvas.height - 72 };
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = "12px ui-monospace, monospace";
    context.strokeStyle = "rgba(255,255,255,0.13)";
    context.fillStyle = "rgba(218,235,228,0.72)";
    for (let i = 0; i <= 5; i += 1) {
      const yValue = yMin + (yMax - yMin) * i / 5;
      const y = geometry.top + geometry.height * (1 - i / 5);
      context.beginPath(); context.moveTo(geometry.left, y); context.lineTo(geometry.left + geometry.width, y); context.stroke();
      context.fillText(yValue.toFixed(2), 8, y + 4);
    }
    for (const gap of [0, 0.5, 1, 2, 4, 6]) {
      const x = geometry.left + geometry.width * gap / 6;
      context.beginPath(); context.moveTo(x, geometry.top); context.lineTo(x, geometry.top + geometry.height); context.stroke();
      context.fillText(`${gap}R`, x - 10, canvas.height - 20);
    }
    return geometry;
  }

  private drawLine(
    canvas: HTMLCanvasElement,
    geometry: { left: number; top: number; width: number; height: number },
    samples: Array<{ x: number; y: number | null }>,
    yMin: number,
    yMax: number,
    stroke: string,
    dashed = false,
  ): void {
    const context = canvas.getContext("2d");
    if (!context) return;
    context.strokeStyle = stroke;
    context.lineWidth = 2.2;
    context.setLineDash(dashed ? [7, 5] : []);
    context.beginPath();
    let started = false;
    for (const sample of samples) {
      if (sample.y === null || !Number.isFinite(sample.y)) { started = false; continue; }
      const x = geometry.left + geometry.width * sample.x / 6;
      const y = geometry.top + geometry.height * (yMax - sample.y) / (yMax - yMin);
      if (!started) { context.moveTo(x, y); started = true; } else context.lineTo(x, y);
    }
    context.stroke();
    context.setLineDash([]);
  }

  private sweep(): Array<{ gap: number; bodyW0: number; deficit: number; direct: number; background: number; net: number }> {
    const count = 160;
    const contactScale = sourceCoefficient(this.model) * receiverAmount(this.model)
      / (this.model.sourceRadius + this.model.receiverRadius) ** 2;
    const scalarScale = Math.max(contactScale, 1e-30);
    const result = [];
    for (let index = 0; index <= count; index += 1) {
      const gap = 6 * index / count;
      const model = {
        ...this.model,
        separation: this.model.sourceRadius + this.model.receiverRadius + gap,
      };
      const shell = shellIntegratedExtendedReceiver(model, 64);
      result.push({
        gap,
        bodyW0: shell.bodyW0 / scalarScale,
        deficit: shell.backgroundStraightDeficit / scalarScale,
        direct: shell.directW1[0] / scalarScale,
        background: shell.backgroundW1[0] / scalarScale,
        net: shell.netW1[0] / scalarScale,
      });
    }
    return result;
  }

  private drawW0Chart(): void {
    const data = this.sweep();
    const yMax = Math.max(...data.map(sample => Math.max(sample.bodyW0, sample.deficit))) * 1.08;
    const geometry = this.chartAxes(this.w0Canvas, 0, yMax);
    this.drawLine(this.w0Canvas, geometry, data.map(s => ({ x: s.gap, y: s.bodyW0 })), 0, yMax, "#65d6ff");
    this.drawLine(this.w0Canvas, geometry, data.map(s => ({ x: s.gap, y: s.deficit })), 0, yMax, "#f0c760");
    this.drawLine(this.w0Canvas, geometry, data.map(s => ({ x: s.gap, y: Math.abs(s.deficit - s.bodyW0) })), 0, yMax, "#f17fb2", true);
  }

  private drawW1Chart(): void {
    const data = this.sweep();
    const bound = Math.max(1, ...data.map(sample => Math.max(Math.abs(sample.direct), Math.abs(sample.background), Math.abs(sample.net)))) * 1.08;
    const geometry = this.chartAxes(this.w1Canvas, -bound, bound);
    this.drawLine(this.w1Canvas, geometry, data.map(s => ({ x: s.gap, y: s.direct })), -bound, bound, "#66e3a4");
    this.drawLine(this.w1Canvas, geometry, data.map(s => ({ x: s.gap, y: s.background })), -bound, bound, "#f08d67");
    this.drawLine(this.w1Canvas, geometry, data.map(s => ({ x: s.gap, y: s.net })), -bound, bound, "#f4f6f5", true);
  }

  private renderParity(parity: ReturnType<typeof extendedReceiverParity>, analyticDirectSigned: number): void {
    const rows: Array<[string, number, number]> = [
      ["M1 direct / M0", parity.shellDirectRelativeError, 1e-11],
      ["M2 direct / M0", parity.cubatureDirectRelativeError, 1e-5],
      ["M1 background / M0", parity.shellBackgroundRelativeError, 1e-11],
      ["M2 background / M0", parity.cubatureBackgroundRelativeError, 1e-5],
      ["M2 body W0 / M1", parity.cubatureBodyW0RelativeError, 1e-4],
      ["M2 deficit W0 / M1", parity.cubatureDeficitRelativeError, 1e-4],
      ["normalized torque", parity.normalizedTorque, 1e-5],
    ];
    required<HTMLElement>(this.root, "#a1-parity-body").innerHTML = rows.map(([label, value, threshold]) => `
      <tr><td>${label}</td><td>${format(value)}</td><td>${threshold.toExponential(1)}</td><td class="${value <= threshold ? "pass-text" : "fail-text"}">${value <= threshold ? "PASS" : "FAIL"}</td></tr>
    `).join("") + `<tr><td>analytic direct resultant</td><td>${format(analyticDirectSigned)}</td><td>shell theorem</td><td class="pass-text">ORACLE</td></tr>`;
  }

  private exportReceipt(): void {
    const parity = extendedReceiverParity(this.model);
    const shell = shellIntegratedExtendedReceiver(this.model);
    const payload = {
      artifact_id: "VOXELLAB_ACTION_TRANSPORT_A1_EXTENDED_RECEIVER_RECEIPT_V1",
      commit: APP_COMMIT,
      model: this.model,
      domain: "NON_OVERLAPPING_UNIFORM_SPHERES_STRAIGHT_ROUTE_CONTROL",
      receiver_amount: receiverAmount(this.model),
      source_coefficient: sourceCoefficient(this.model),
      shell_readout: shell,
      parity,
      verdict: parity.shellDirectRelativeError <= 1e-11
        && parity.cubatureDirectRelativeError <= 1e-5
        && parity.cubatureBodyW0RelativeError <= 1e-4
        && parity.normalizedTorque <= 1e-5
          ? "EXTENDED_SPHERICAL_RECEIVER_PRESERVES_EXTERIOR_PROPORTIONALITY"
          : "NUMERICAL_PARITY_BLOCKER",
      physical_force_available: false,
      finite_equilibrium_claimed: false,
      overlap_opened: false,
      redirection_opened: false,
      scale_bound: false,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "VOXELLAB_ACTION_TRANSPORT_A1_EXTENDED_RECEIVER_RECEIPT.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
}
