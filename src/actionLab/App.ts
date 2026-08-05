import {
  analyticSphereOutside,
  chordProfile,
  createVolumeCubature,
  curvedSolidAngleSphere,
  distributedVolumeSphere,
  normalizedDisplayValue,
  relativeError,
  rendererCapImportanceSphere,
  type FieldSample,
  type SphereModel,
  type Vec3,
  type VolumeCubature,
} from "./math";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";
const FROZEN_DISTANCES = [1.05, 1.1, 1.2, 1.5, 2, 3, 5, 8] as const;

type DisplayChannel = "W0" | "W1";
type MethodId = "ANALYTIC_ORACLE" | "DISTRIBUTED_VOLUME" | "CURVED_H_OMEGA" | "RENDERER_RAYS";

interface MethodResult {
  id: MethodId;
  label: string;
  sample: FieldSample;
  relativeW0: number;
  relativeW1: number;
  detail: string;
}

interface AuditResult {
  rows: Array<{
    distanceRatio: number;
    oracle: FieldSample;
    volume: FieldSample;
    curved: FieldSample;
    renderer: FieldSample;
  }>;
  maximumVolumeError: number;
  maximumCurvedError: number;
  maximumRendererError: number;
  farLawResidual: number;
  status: "PASS" | "BLOCKED";
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing Action Lab element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(5);
  return value.toFixed(6);
}

function formatPercent(value: number): string {
  return `${(100 * value).toFixed(value < 1e-3 ? 4 : 2)}%`;
}

function magnitude(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalizedDirection(value: Vec3): Vec3 {
  const length = magnitude(value);
  return length > 0 ? [value[0] / length, value[1] / length, value[2] / length] : [0, 0, 0];
}

function colorMap(value: number): readonly [number, number, number] {
  const t = Math.max(0, Math.min(1, value));
  const stops: Array<readonly [number, number, number, number]> = [
    [0, 6, 13, 24],
    [0.18, 14, 43, 62],
    [0.42, 19, 91, 106],
    [0.68, 67, 164, 151],
    [0.86, 212, 193, 92],
    [1, 255, 235, 171],
  ];
  for (let index = 1; index < stops.length; index += 1) {
    const left = stops[index - 1];
    const right = stops[index];
    if (!left || !right || t > right[0]) continue;
    const u = (t - left[0]) / (right[0] - left[0]);
    return [
      Math.round(left[1] + u * (right[1] - left[1])),
      Math.round(left[2] + u * (right[2] - left[2])),
      Math.round(left[3] + u * (right[3] - left[3])),
    ];
  }
  return [255, 235, 171];
}

function createTemplate(): string {
  return `
    <main class="action-lab-shell">
      <header class="action-topbar">
        <div>
          <p class="eyebrow">VOXELLAB · SEPARATE RESEARCH SITE</p>
          <h1>Action Transport Lab <span>A0</span></h1>
          <p class="subtitle">Straight routes · formed sphere · amount + geometry · four-route numerical parity</p>
        </div>
        <div class="topbar-links">
          <span class="status-chip">METHOD / VISUALIZATION ONLY</span>
          <code id="action-commit"></code>
          <a href="/voxellab-web/">Scene Lab S01–S17 ↗</a>
        </div>
      </header>

      <section class="action-grid">
        <aside class="control-panel card">
          <p class="eyebrow">FIXTURE</p>
          <h2>Formed uniform sphere</h2>
          <label>Radius R <input id="sphere-radius" type="range" min="0.6" max="1.5" step="0.05" value="1"></label>
          <output id="sphere-radius-value">1.00</output>
          <label>Amount density q <input id="sphere-density" type="range" min="0.25" max="2" step="0.05" value="1"></label>
          <output id="sphere-density-value">1.00</output>
          <label>View extent <input id="map-extent" type="range" min="2.5" max="6" step="0.25" value="4"></label>
          <output id="map-extent-value">±4.00 R</output>
          <label>Heatmap channel
            <select id="display-channel">
              <option value="W0">W0 · scalar delivered action column</option>
              <option value="W1">|W1| · directional resultant magnitude</option>
            </select>
          </label>
          <label class="check-row"><input id="show-vectors" type="checkbox" checked> Show W1 direction arrows</label>
          <label>Renderer samples
            <select id="renderer-samples">
              <option value="512">512</option>
              <option value="2048" selected>2,048</option>
              <option value="8192">8,192</option>
            </select>
          </label>
          <button id="reset-fixture" class="primary">RESET A0</button>
          <button id="export-receipt">EXPORT PROBE RECEIPT</button>
          <div class="firewall-box">
            <strong>Claim ceiling</strong>
            <span>DIMENSIONLESS STRAIGHT-ROUTE ACTION READOUT</span>
            <small>Not field density · not physical force · no cadence · no scale binding · no GRIN.</small>
          </div>
        </aside>

        <section class="map-card card">
          <div class="section-head">
            <div><p class="eyebrow">SPATIAL READOUT</p><h2 id="map-title">W0 action column</h2></div>
            <span id="map-semantic" class="semantic-chip">∫V q dV/r² = ∫S² Hq(Ω)dΩ</span>
          </div>
          <canvas id="field-map" width="720" height="720" data-testid="action-field-map"></canvas>
          <div class="map-legend"><span>far / weak</span><i></i><span>surface-normalized 1.0</span></div>
          <p class="hint">Click anywhere outside the body to move the receiver probe. The body interior is intentionally masked.</p>
        </section>

        <aside class="probe-panel card">
          <p class="eyebrow">SELECTED PROBE</p>
          <h2 id="probe-position">x/R = 1.800</h2>
          <div class="probe-summary">
            <div><span>Distance</span><strong id="probe-distance"></strong></div>
            <div><span>Angular radius</span><strong id="probe-angle"></strong></div>
            <div><span>Visible cap Ω</span><strong id="probe-cap"></strong></div>
            <div><span>Analytic W0</span><strong id="probe-w0"></strong></div>
            <div><span>Analytic |W1|</span><strong id="probe-w1"></strong></div>
            <div><span>Far-law check</span><strong id="probe-far-law"></strong></div>
          </div>
          <div class="quantity-passport">
            <strong>What the color means</strong>
            <p id="quantity-passport-text"></p>
          </div>
          <div class="table-wrap"><table class="method-table" data-testid="probe-method-table">
            <thead><tr><th>Route</th><th>W0</th><th>|W1|</th><th>rel. error</th></tr></thead>
            <tbody id="probe-method-body"></tbody>
          </table></div>
          <p id="probe-method-note" class="method-note"></p>
        </aside>
      </section>

      <section class="analysis-grid">
        <article class="card angular-card">
          <div class="section-head"><div><p class="eyebrow">CURVED RECEIVER SPHERE</p><h2>Directional thickness H(Ω)</h2></div><span>all exact ray intervals</span></div>
          <canvas id="angular-map" width="620" height="360" data-testid="angular-thickness-map"></canvas>
          <p>The disc is the real spherical footprint seen from the probe. Color is chord thickness, not a flat S·H proxy.</p>
        </article>

        <article class="card profile-card">
          <div class="section-head"><div><p class="eyebrow">RADIAL PARITY</p><h2>Four routes on one 1/r² profile</h2></div><span>R+ to 8R</span></div>
          <canvas id="profile-chart" width="760" height="360" data-testid="action-profile-chart"></canvas>
          <div class="profile-legend"><span class="oracle">Oracle</span><span class="volume">Small bodies</span><span class="curved">Curved H(Ω)</span><span class="renderer">Renderer rays</span></div>
        </article>
      </section>

      <section class="audit-card card">
        <div class="section-head">
          <div><p class="eyebrow">A0 FROZEN GATE</p><h2>Straight-route spatial action renderer parity</h2></div>
          <span id="audit-status" class="audit-badge" data-testid="action-audit-status">RUNNING</span>
        </div>
        <div class="audit-metrics" data-testid="action-audit-metrics">
          <div><span>Volume cubature max</span><strong id="audit-volume"></strong></div>
          <div><span>Curved H(Ω) max</span><strong id="audit-curved"></strong></div>
          <div><span>Renderer rays max</span><strong id="audit-renderer"></strong></div>
          <div><span>Analytic far-law residual</span><strong id="audit-far"></strong></div>
        </div>
        <p id="audit-verdict"></p>
        <div class="route-chain">
          <span>formed body</span><b>→</b><span>amount + geometry</span><b>→</b><span>straight routes</span><b>→</b><span>distributed action map</span><b>→</b><span>resultant / torque later</span>
        </div>
      </section>
    </main>
  `;
}

export class ActionTransportApp {
  private model: SphereModel = { radius: 1, density: 1 };
  private extentInRadii = 4;
  private channel: DisplayChannel = "W0";
  private showVectors = true;
  private rendererSamples = 2048;
  private probe: Vec3 = [1.8, 0, 0];
  private cubature: VolumeCubature = createVolumeCubature(this.model);

  private readonly fieldCanvas: HTMLCanvasElement;
  private readonly angularCanvas: HTMLCanvasElement;
  private readonly profileCanvas: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = createTemplate();
    required<HTMLElement>(root, "#action-commit").textContent = `commit ${APP_COMMIT.slice(0, 12)}`;
    this.fieldCanvas = required<HTMLCanvasElement>(root, "#field-map");
    this.angularCanvas = required<HTMLCanvasElement>(root, "#angular-map");
    this.profileCanvas = required<HTMLCanvasElement>(root, "#profile-chart");
    this.bindControls();
    this.renderAll();
  }

  private bindControls(): void {
    const radius = required<HTMLInputElement>(this.root, "#sphere-radius");
    const density = required<HTMLInputElement>(this.root, "#sphere-density");
    const extent = required<HTMLInputElement>(this.root, "#map-extent");
    const channel = required<HTMLSelectElement>(this.root, "#display-channel");
    const vectors = required<HTMLInputElement>(this.root, "#show-vectors");
    const rendererSamples = required<HTMLSelectElement>(this.root, "#renderer-samples");

    radius.addEventListener("input", () => {
      this.model = { ...this.model, radius: Number(radius.value) };
      this.probe = [1.8 * this.model.radius, 0, 0];
      this.rebuildCubature();
      this.renderAll();
    });
    density.addEventListener("input", () => {
      this.model = { ...this.model, density: Number(density.value) };
      this.renderAll();
    });
    extent.addEventListener("input", () => {
      this.extentInRadii = Number(extent.value);
      this.renderAll();
    });
    channel.addEventListener("change", () => {
      this.channel = channel.value as DisplayChannel;
      this.renderAll();
    });
    vectors.addEventListener("change", () => {
      this.showVectors = vectors.checked;
      this.renderFieldMap();
    });
    rendererSamples.addEventListener("change", () => {
      this.rendererSamples = Number(rendererSamples.value);
      this.renderAll();
    });
    required<HTMLButtonElement>(this.root, "#reset-fixture").addEventListener("click", () => {
      radius.value = "1";
      density.value = "1";
      extent.value = "4";
      channel.value = "W0";
      vectors.checked = true;
      rendererSamples.value = "2048";
      this.model = { radius: 1, density: 1 };
      this.extentInRadii = 4;
      this.channel = "W0";
      this.showVectors = true;
      this.rendererSamples = 2048;
      this.probe = [1.8, 0, 0];
      this.rebuildCubature();
      this.renderAll();
    });
    required<HTMLButtonElement>(this.root, "#export-receipt").addEventListener("click", () => this.exportReceipt());
    this.fieldCanvas.addEventListener("click", event => this.moveProbe(event));
  }

  private rebuildCubature(): void {
    this.cubature = createVolumeCubature(this.model);
  }

  private renderAll(): void {
    required<HTMLOutputElement>(this.root, "#sphere-radius-value").value = this.model.radius.toFixed(2);
    required<HTMLOutputElement>(this.root, "#sphere-density-value").value = this.model.density.toFixed(2);
    required<HTMLOutputElement>(this.root, "#map-extent-value").value = `±${this.extentInRadii.toFixed(2)} R`;
    this.renderFieldMap();
    this.renderAngularMap();
    this.renderProbePanel();
    const audit = this.calculateFrozenAudit();
    this.renderProfile(audit);
    this.renderAudit(audit);
  }

  private worldFromCanvas(canvasX: number, canvasY: number): Vec3 {
    const extent = this.extentInRadii * this.model.radius;
    return [
      (canvasX / this.fieldCanvas.width * 2 - 1) * extent,
      (1 - canvasY / this.fieldCanvas.height * 2) * extent,
      0,
    ];
  }

  private canvasFromWorld(point: Vec3): readonly [number, number] {
    const extent = this.extentInRadii * this.model.radius;
    return [
      (point[0] / extent + 1) * 0.5 * this.fieldCanvas.width,
      (1 - point[1] / extent) * 0.5 * this.fieldCanvas.height,
    ];
  }

  private moveProbe(event: MouseEvent): void {
    const bounds = this.fieldCanvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * this.fieldCanvas.width;
    const y = (event.clientY - bounds.top) / bounds.height * this.fieldCanvas.height;
    let point = this.worldFromCanvas(x, y);
    const distance = magnitude(point);
    const minimum = 1.02 * this.model.radius;
    if (distance < minimum) {
      const direction: Vec3 = distance > 1e-12 ? [point[0] / distance, point[1] / distance, 0] : [1, 0, 0];
      point = [direction[0] * minimum, direction[1] * minimum, 0];
    }
    this.probe = point;
    this.renderAll();
  }

  private renderFieldMap(): void {
    const context = this.fieldCanvas.getContext("2d");
    if (!context) throw new Error("2D canvas unavailable");
    const gridSize = 240;
    const offscreen = document.createElement("canvas");
    offscreen.width = gridSize;
    offscreen.height = gridSize;
    const offscreenContext = offscreen.getContext("2d");
    if (!offscreenContext) throw new Error("Offscreen 2D canvas unavailable");
    const image = offscreenContext.createImageData(gridSize, gridSize);
    const extent = this.extentInRadii * this.model.radius;
    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        const worldX = (column / (gridSize - 1) * 2 - 1) * extent;
        const worldY = (1 - row / (gridSize - 1) * 2) * extent;
        const distance = Math.hypot(worldX, worldY);
        const offset = 4 * (row * gridSize + column);
        if (distance <= this.model.radius * 1.002) {
          image.data[offset] = 7;
          image.data[offset + 1] = 10;
          image.data[offset + 2] = 15;
          image.data[offset + 3] = 255;
          continue;
        }
        const sample = analyticSphereOutside([worldX, worldY, 0], this.model);
        const normalized = normalizedDisplayValue(sample, this.model, this.channel);
        const [red, green, blue] = colorMap(Math.sqrt(Math.max(0, normalized)));
        image.data[offset] = red;
        image.data[offset + 1] = green;
        image.data[offset + 2] = blue;
        image.data[offset + 3] = 255;
      }
    }
    offscreenContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, this.fieldCanvas.width, this.fieldCanvas.height);
    context.imageSmoothingEnabled = true;
    context.drawImage(offscreen, 0, 0, this.fieldCanvas.width, this.fieldCanvas.height);

    context.save();
    context.strokeStyle = "rgba(219,236,228,0.18)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(this.fieldCanvas.width / 2, 0);
    context.lineTo(this.fieldCanvas.width / 2, this.fieldCanvas.height);
    context.moveTo(0, this.fieldCanvas.height / 2);
    context.lineTo(this.fieldCanvas.width, this.fieldCanvas.height / 2);
    context.stroke();

    const [centreX, centreY] = this.canvasFromWorld([0, 0, 0]);
    const pixelsPerUnit = this.fieldCanvas.width / (2 * extent);
    context.fillStyle = "rgba(8,11,16,0.92)";
    context.strokeStyle = "rgba(236,220,164,0.95)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centreX, centreY, this.model.radius * pixelsPerUnit, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (this.showVectors) this.drawVectorField(context);

    const [probeX, probeY] = this.canvasFromWorld(this.probe);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#07100f";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(probeX, probeY, 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.font = "12px ui-monospace, monospace";
    context.fillText("probe", probeX + 10, probeY - 10);
    context.restore();

    const title = this.channel === "W0" ? "W0 · scalar delivered action column" : "|W1| · directional resultant magnitude";
    required<HTMLElement>(this.root, "#map-title").textContent = title;
    required<HTMLElement>(this.root, "#map-semantic").textContent = this.channel === "W0"
      ? "∫V q dV/r² = ∫S² Hq(Ω)dΩ"
      : "|∫V q r̂ dV/r²|";
    required<HTMLElement>(this.root, "#quantity-passport-text").textContent = this.channel === "W0"
      ? "Color is the positive scalar amount of straight-route action delivered by the whole formed sphere to a point, normalized only for display by its surface value. It is not field amount or force."
      : "Color is the magnitude of the first directional moment W1. Arrows retain direction; the scalar color alone is a compressed view.";
  }

  private drawVectorField(context: CanvasRenderingContext2D): void {
    const extent = this.extentInRadii * this.model.radius;
    const spacing = 52;
    context.save();
    context.strokeStyle = "rgba(255,255,255,0.64)";
    context.fillStyle = "rgba(255,255,255,0.64)";
    context.lineWidth = 1.15;
    for (let pixelY = spacing / 2; pixelY < this.fieldCanvas.height; pixelY += spacing) {
      for (let pixelX = spacing / 2; pixelX < this.fieldCanvas.width; pixelX += spacing) {
        const point = this.worldFromCanvas(pixelX, pixelY);
        const distance = magnitude(point);
        if (distance <= 1.08 * this.model.radius || distance > extent) continue;
        const sample = analyticSphereOutside(point, this.model);
        const direction = normalizedDirection(sample.w1);
        const strength = Math.min(1, normalizedDisplayValue(sample, this.model, "W1"));
        const length = 8 + 18 * Math.sqrt(strength);
        const endX = pixelX + direction[0] * length;
        const endY = pixelY - direction[1] * length;
        context.beginPath();
        context.moveTo(pixelX, pixelY);
        context.lineTo(endX, endY);
        context.stroke();
        const angle = Math.atan2(endY - pixelY, endX - pixelX);
        context.beginPath();
        context.moveTo(endX, endY);
        context.lineTo(endX - 4 * Math.cos(angle - 0.55), endY - 4 * Math.sin(angle - 0.55));
        context.lineTo(endX - 4 * Math.cos(angle + 0.55), endY - 4 * Math.sin(angle + 0.55));
        context.closePath();
        context.fill();
      }
    }
    context.restore();
  }

  private renderAngularMap(): void {
    const context = this.angularCanvas.getContext("2d");
    if (!context) throw new Error("Angular canvas unavailable");
    const width = this.angularCanvas.width;
    const height = this.angularCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, width, height);
    const centreX = width * 0.39;
    const centreY = height * 0.5;
    const radius = Math.min(width, height) * 0.38;
    const profile = chordProfile(magnitude(this.probe), this.model, 160);
    const gradient = context.createRadialGradient(centreX, centreY, 0, centreX, centreY, radius);
    for (const item of profile) {
      const [red, green, blue] = colorMap(Math.sqrt(Math.max(0, item.chord / (2 * this.model.radius))));
      gradient.addColorStop(item.radialFraction, `rgb(${red} ${green} ${blue})`);
    }
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(centreX, centreY, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(245,233,192,0.95)";
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,0.28)";
    context.lineWidth = 1;
    for (const fraction of [0.25, 0.5, 0.75]) {
      context.beginPath();
      context.arc(centreX, centreY, radius * fraction, 0, Math.PI * 2);
      context.stroke();
    }
    const distance = magnitude(this.probe);
    const alpha = Math.asin(this.model.radius / distance);
    const capSolidAngle = 2 * Math.PI * (1 - Math.cos(alpha));
    context.fillStyle = "rgba(236,244,239,0.92)";
    context.font = "14px ui-monospace, monospace";
    context.fillText(`owner: formed_sphere`, width * 0.7, 70);
    context.fillText(`α = ${(alpha * 180 / Math.PI).toFixed(3)}°`, width * 0.7, 105);
    context.fillText(`Ωcap = ${format(capSolidAngle)} sr`, width * 0.7, 140);
    context.fillText(`Hmax = ${(2 * this.model.radius).toFixed(4)}`, width * 0.7, 175);
    context.fillText(`Hedge = 0`, width * 0.7, 210);
    context.fillStyle = "rgba(175,201,191,0.8)";
    context.font = "12px system-ui, sans-serif";
    context.fillText("Curved footprint, not flat projected area", width * 0.64, 270);
  }

  private methodResults(probe: Vec3): MethodResult[] {
    const oracle = analyticSphereOutside(probe, this.model);
    const volume = distributedVolumeSphere(probe, this.model, this.cubature);
    const curved = curvedSolidAngleSphere(probe, this.model, 96);
    const renderer = rendererCapImportanceSphere(probe, this.model, this.rendererSamples);
    const row = (id: MethodId, label: string, sample: FieldSample, detail: string): MethodResult => ({
      id,
      label,
      sample,
      relativeW0: relativeError(sample.w0, oracle.w0),
      relativeW1: relativeError(sample.w1Magnitude, oracle.w1Magnitude),
      detail,
    });
    return [
      row("ANALYTIC_ORACLE", "Analytic sphere", oracle, "closed-form exterior oracle"),
      row("DISTRIBUTED_VOLUME", "Small bodies", volume, `${this.cubature.points.length.toLocaleString()} equal-volume samples`),
      row("CURVED_H_OMEGA", "Curved H(Ω)", curved, "96-point polar Gauss + exact chord"),
      row("RENDERER_RAYS", "Renderer rays", renderer, `${this.rendererSamples.toLocaleString()} deterministic cap samples`),
    ];
  }

  private renderProbePanel(): void {
    const distance = magnitude(this.probe);
    const ratio = distance / this.model.radius;
    const alpha = Math.asin(this.model.radius / distance);
    const capSolidAngle = 2 * Math.PI * (1 - Math.cos(alpha));
    const methods = this.methodResults(this.probe);
    const oracle = methods[0];
    if (!oracle) throw new Error("Missing analytic oracle result");
    required<HTMLElement>(this.root, "#probe-position").textContent = `probe = (${(this.probe[0] / this.model.radius).toFixed(3)}, ${(this.probe[1] / this.model.radius).toFixed(3)}, 0) R`;
    required<HTMLElement>(this.root, "#probe-distance").textContent = `${ratio.toFixed(4)} R`;
    required<HTMLElement>(this.root, "#probe-angle").textContent = `${(alpha * 180 / Math.PI).toFixed(4)}°`;
    required<HTMLElement>(this.root, "#probe-cap").textContent = `${format(capSolidAngle)} sr`;
    required<HTMLElement>(this.root, "#probe-w0").textContent = format(oracle.sample.w0);
    required<HTMLElement>(this.root, "#probe-w1").textContent = format(oracle.sample.w1Magnitude);
    const expectedFar = this.model.density * (4 / 3) * Math.PI * this.model.radius ** 3 / distance ** 2;
    required<HTMLElement>(this.root, "#probe-far-law").textContent = formatPercent(relativeError(oracle.sample.w1Magnitude, expectedFar));
    required<HTMLTableSectionElement>(this.root, "#probe-method-body").innerHTML = methods.map(method => `
      <tr data-method="${method.id}">
        <td><strong>${method.label}</strong><small>${method.detail}</small></td>
        <td>${format(method.sample.w0)}</td>
        <td>${format(method.sample.w1Magnitude)}</td>
        <td>${method.id === "ANALYTIC_ORACLE" ? "reference" : `${formatPercent(Math.max(method.relativeW0, method.relativeW1))}`}</td>
      </tr>
    `).join("");
    required<HTMLElement>(this.root, "#probe-method-note").textContent = "All physical channels are positive. The vector sign is carried only by direction. W1 is a compressed directional readout of the full angular action map.";
  }

  private calculateFrozenAudit(): AuditResult {
    const rows = FROZEN_DISTANCES.map(distanceRatio => {
      const probe: Vec3 = [distanceRatio * this.model.radius, 0, 0];
      return {
        distanceRatio,
        oracle: analyticSphereOutside(probe, this.model),
        volume: distributedVolumeSphere(probe, this.model, this.cubature),
        curved: curvedSolidAngleSphere(probe, this.model, 96),
        renderer: rendererCapImportanceSphere(probe, this.model, this.rendererSamples),
      };
    });
    let maximumVolumeError = 0;
    let maximumCurvedError = 0;
    let maximumRendererError = 0;
    let farLawResidual = 0;
    for (const row of rows) {
      maximumVolumeError = Math.max(maximumVolumeError,
        relativeError(row.volume.w0, row.oracle.w0), relativeError(row.volume.w1Magnitude, row.oracle.w1Magnitude));
      maximumCurvedError = Math.max(maximumCurvedError,
        relativeError(row.curved.w0, row.oracle.w0), relativeError(row.curved.w1Magnitude, row.oracle.w1Magnitude));
      maximumRendererError = Math.max(maximumRendererError,
        relativeError(row.renderer.w0, row.oracle.w0), relativeError(row.renderer.w1Magnitude, row.oracle.w1Magnitude));
      const expected = this.model.density * (4 / 3) * Math.PI * this.model.radius ** 3 / (row.distanceRatio * this.model.radius) ** 2;
      farLawResidual = Math.max(farLawResidual, relativeError(row.oracle.w1Magnitude, expected));
    }
    const status = maximumVolumeError <= 2e-3
      && maximumCurvedError <= 2e-5
      && maximumRendererError <= 2e-4
      && farLawResidual <= 1e-12 ? "PASS" : "BLOCKED";
    return { rows, maximumVolumeError, maximumCurvedError, maximumRendererError, farLawResidual, status };
  }

  private renderProfile(audit: AuditResult): void {
    const context = this.profileCanvas.getContext("2d");
    if (!context) throw new Error("Profile canvas unavailable");
    const width = this.profileCanvas.width;
    const height = this.profileCanvas.height;
    const margin = { left: 62, right: 20, top: 24, bottom: 44 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,0.13)";
    context.fillStyle = "rgba(220,235,228,0.72)";
    context.font = "12px ui-monospace, monospace";
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = margin.top + tick / 4 * plotHeight;
      context.beginPath();
      context.moveTo(margin.left, y);
      context.lineTo(width - margin.right, y);
      context.stroke();
      const exponent = -tick * 0.5;
      context.fillText(`10^${exponent.toFixed(1)}`, 8, y + 4);
    }
    for (const ratio of [1, 2, 3, 5, 8]) {
      const x = margin.left + (ratio - 1) / 7 * plotWidth;
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, height - margin.bottom);
      context.stroke();
      context.fillText(`${ratio}R`, x - 10, height - 17);
    }
    const xOf = (ratio: number) => margin.left + (ratio - 1) / 7 * plotWidth;
    const yOf = (value: number) => {
      const logValue = Math.log10(Math.max(1e-3, value));
      return margin.top + (-logValue / 2) * plotHeight;
    };
    const drawSeries = (selector: (row: AuditResult["rows"][number]) => FieldSample, stroke: string, widthValue: number) => {
      context.strokeStyle = stroke;
      context.lineWidth = widthValue;
      context.beginPath();
      audit.rows.forEach((row, index) => {
        const normalized = normalizedDisplayValue(selector(row), this.model, "W1");
        const x = xOf(row.distanceRatio);
        const y = yOf(normalized);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    drawSeries(row => row.oracle, "#f4e4ad", 3.5);
    drawSeries(row => row.volume, "#67bda8", 2);
    drawSeries(row => row.curved, "#8aa7ff", 2);
    drawSeries(row => row.renderer, "#ef8f70", 2);
    context.fillStyle = "rgba(220,235,228,0.84)";
    context.fillText("normalized |W1| (log)", 8, 16);
  }

  private renderAudit(audit: AuditResult): void {
    const status = required<HTMLElement>(this.root, "#audit-status");
    status.textContent = audit.status === "PASS" ? "A0 PARITY PASS" : "A0 BLOCKED";
    status.className = `audit-badge ${audit.status === "PASS" ? "pass" : "blocked"}`;
    required<HTMLElement>(this.root, "#audit-volume").textContent = formatPercent(audit.maximumVolumeError);
    required<HTMLElement>(this.root, "#audit-curved").textContent = formatPercent(audit.maximumCurvedError);
    required<HTMLElement>(this.root, "#audit-renderer").textContent = formatPercent(audit.maximumRendererError);
    required<HTMLElement>(this.root, "#audit-far").textContent = formatPercent(audit.farLawResidual);
    required<HTMLElement>(this.root, "#audit-verdict").textContent = audit.status === "PASS"
      ? "STRAIGHT_ROUTE_SPATIAL_ACTION_RENDERER_PARITY_PASS for the analytic exterior-sphere fixture. This is a numerical method result only."
      : "A0 parity is locally blocked at the current sampling settings. Increase renderer samples or inspect the volume/near-surface corridor; no tolerance is silently loosened.";
  }

  private exportReceipt(): void {
    const methods = this.methodResults(this.probe);
    const audit = this.calculateFrozenAudit();
    const receipt = {
      receipt_version: "A0.1",
      app_commit: APP_COMMIT,
      generated_at: new Date().toISOString(),
      fixture: {
        type: "FORMED_UNIFORM_SPHERE_EXTERIOR_PROBE",
        radius: this.model.radius,
        amount_density: this.model.density,
        probe: this.probe,
        routes: ["ANALYTIC_ORACLE", "DISTRIBUTED_VOLUME", "CURVED_H_OMEGA", "RENDERER_CAP_IMPORTANCE"],
      },
      quantity_semantics: {
        W0: "POSITIVE_SCALAR_DELIVERED_ACTION_COLUMN",
        W1: "POSITIVE_DIRECTIONAL_FIRST_MOMENT_WITH_ORIENTATION",
        heatmap_normalization: "DISPLAY_ONLY_DIVIDE_BY_SURFACE_ORACLE",
        physical_force_available: false,
      },
      methods,
      audit: {
        status: audit.status,
        maximum_volume_error: audit.maximumVolumeError,
        maximum_curved_error: audit.maximumCurvedError,
        maximum_renderer_error: audit.maximumRendererError,
        far_law_residual: audit.farLawResidual,
      },
      firewalls: ["NO_GRIN", "NO_PHYSICAL_FORCE", "NO_SCALE_BINDING", "NO_VALIDATION", "NO_CANON_PROMOTION"],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "VOXELLAB_ACTION_TRANSPORT_A0_PROBE_RECEIPT.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
}
