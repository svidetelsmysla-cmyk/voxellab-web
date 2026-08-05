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
import {
  analyticIsotropicSphereBackground,
  backgroundRelativeError,
  curvedIsotropicSphereBackground,
  rendererIsotropicSphereBackground,
  type BackgroundLedger,
  type IsotropicBackgroundModel,
  type RendererBackgroundLedger,
} from "./background";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";
const FROZEN_DISTANCES = [1.05, 1.1, 1.2, 1.5, 2, 3, 5, 8] as const;

type DisplayChannel =
  | "BODY_W0"
  | "BODY_W1"
  | "BG_DEFICIT"
  | "BG_STRAIGHT"
  | "BG_RESULTANT";

type BackgroundMethodId = "ANALYTIC_CAP" | "CURVED_CAP" | "RENDERER_FIRST_HIT";
type BodyMethodId = "ANALYTIC_BODY" | "SMALL_BODIES" | "CURVED_H_OMEGA" | "RENDERER_CHORDS";

interface BackgroundMethodResult {
  id: BackgroundMethodId;
  label: string;
  ledger: BackgroundLedger | RendererBackgroundLedger;
  scalarError: number;
  vectorError: number;
  detail: string;
}

interface BodyMethodResult {
  id: BodyMethodId;
  label: string;
  sample: FieldSample;
  scalarError: number;
  vectorError: number;
  detail: string;
}

interface AuditResult {
  maximumCurvedError: number;
  maximumRendererError: number;
  maximumScalarClosure: number;
  maximumVectorClosure: number;
  farLawResidual: number;
  inheritedBodyMaximumError: number;
  status: "PASS" | "BLOCKED";
  rows: Array<{
    distanceRatio: number;
    analytic: BackgroundLedger;
    curved: BackgroundLedger;
    renderer: RendererBackgroundLedger;
    body: FieldSample;
  }>;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing Action Lab A0.2 element: ${selector}`);
  return value;
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(5);
  return value.toFixed(6);
}

function formatPercent(value: number): string {
  return `${(100 * value).toFixed(value < 1e-3 ? 5 : 3)}%`;
}

function magnitude(value: Vec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalizedDirection(value: Vec3): Vec3 {
  const length = magnitude(value);
  return length > 0 ? [value[0] / length, value[1] / length, value[2] / length] : [0, 0, 0];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function heatColor(value: number): readonly [number, number, number] {
  const t = clamp01(value);
  const stops: Array<readonly [number, number, number, number]> = [
    [0, 5, 12, 22],
    [0.18, 9, 37, 58],
    [0.4, 12, 91, 111],
    [0.62, 42, 154, 145],
    [0.82, 205, 176, 75],
    [1, 255, 231, 166],
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
  return [255, 231, 166];
}

function createTemplate(): string {
  return `
    <main class="action-lab-shell a02-shell">
      <header class="action-topbar">
        <div>
          <p class="eyebrow">VOXELLAB · SEPARATE RESEARCH SITE</p>
          <h1>Action Transport Lab <span>A0.2</span></h1>
          <p class="subtitle">One formed sphere · two distinct maps · delivered body action vs isotropic-background deficit</p>
        </div>
        <div class="topbar-links">
          <span class="status-chip">OPAQUE FIRST-HIT CONTROL · NOT FINAL OPACITY LAW</span>
          <code id="action-commit"></code>
          <a href="/voxellab-web/">Scene Lab S01–S17 ↗</a>
        </div>
      </header>

      <section class="a02-explanation card">
        <div><strong>A0.1 · BODY → PROBE</strong><span>How much positive straight-route action the formed body's full volume delivers to the selected place.</span></div>
        <div class="a02-separator">≠</div>
        <div><strong>A0.2 · SKY → BODY SILHOUETTE → PROBE</strong><span>How an opaque first-hit silhouette removes one angular part of an otherwise cancelling isotropic background.</span></div>
      </section>

      <section class="action-grid">
        <aside class="control-panel card">
          <p class="eyebrow">FROZEN SPHERE FIXTURE</p>
          <h2>Amount + geometry</h2>
          <label>Radius R <input id="sphere-radius" type="range" min="0.6" max="1.5" step="0.05" value="1"></label>
          <output id="sphere-radius-value">1.00</output>
          <label>Body amount density q <input id="body-density" type="range" min="0.25" max="2" step="0.05" value="1"></label>
          <output id="body-density-value">1.00</output>
          <label>Isotropic incident I / sr <input id="background-intensity" type="range" min="0.25" max="2" step="0.05" value="1"></label>
          <output id="background-intensity-value">1.00</output>
          <label>View extent <input id="map-extent" type="range" min="2.5" max="6" step="0.25" value="4"></label>
          <output id="map-extent-value">±4.00 R</output>
          <label>Visible quantity
            <select id="display-channel">
              <optgroup label="A0.2 · isotropic background">
                <option value="BG_DEFICIT" selected>straight deficit fraction</option>
                <option value="BG_STRAIGHT">straight surviving fraction</option>
                <option value="BG_RESULTANT">|residual from deficit|</option>
              </optgroup>
              <optgroup label="A0.1 · formed body">
                <option value="BODY_W0">body-delivered W0</option>
                <option value="BODY_W1">body-delivered |W1|</option>
              </optgroup>
            </select>
          </label>
          <label class="check-row"><input id="show-vectors" type="checkbox" checked> Show directional arrows</label>
          <label>Renderer first-hit samples
            <select id="renderer-samples">
              <option value="2048">2,048</option>
              <option value="4096" selected>4,096</option>
              <option value="16384">16,384</option>
            </select>
          </label>
          <button id="reset-fixture" class="primary">RESET A0.2</button>
          <button id="export-receipt">EXPORT A0.2 RECEIPT</button>
          <div class="firewall-box">
            <strong>Claim ceiling</strong>
            <span>GEOMETRY / ACTION-LEDGER CONTROL</span>
            <small>No field-density claim · no physical force · no cadence · no scale · no GRIN · no final opacity law.</small>
          </div>
        </aside>

        <section class="map-card card">
          <div class="section-head">
            <div><p class="eyebrow">SPATIAL READOUT</p><h2 id="map-title"></h2></div>
            <span id="map-semantic" class="semantic-chip"></span>
          </div>
          <canvas id="field-map" width="720" height="720" data-testid="action-field-map"></canvas>
          <div class="map-legend"><span id="legend-left"></span><i></i><span id="legend-right"></span></div>
          <p id="map-hint" class="hint"></p>
        </section>

        <aside class="probe-panel card">
          <p class="eyebrow">SELECTED RECEIVER PROBE</p>
          <h2 id="probe-position"></h2>
          <div class="quantity-passport a02-passport">
            <strong>A0.2 background ledger</strong>
            <p>All scalar channels are positive. Opposition exists only in vector orientation. The full isotropic vector is zero before the body removes a cap.</p>
          </div>
          <div class="probe-summary a02-summary" data-testid="background-ledger">
            <div><span>Incident 4πI</span><strong id="bg-incident"></strong></div>
            <div><span>Straight surviving</span><strong id="bg-surviving"></strong></div>
            <div><span>Straight deficit</span><strong id="bg-deficit"></strong></div>
            <div><span>Deficit fraction</span><strong id="bg-deficit-fraction"></strong></div>
            <div><span>|residual|</span><strong id="bg-resultant"></strong></div>
            <div><span>Residual direction</span><strong id="bg-direction"></strong></div>
            <div><span>Scalar closure</span><strong id="bg-scalar-closure"></strong></div>
            <div><span>Vector closure</span><strong id="bg-vector-closure"></strong></div>
          </div>
          <div class="table-wrap"><table class="method-table" data-testid="background-method-table">
            <thead><tr><th>Background route</th><th>deficit</th><th>|residual|</th><th>error</th></tr></thead>
            <tbody id="background-method-body"></tbody>
          </table></div>

          <details class="body-details" open>
            <summary>A0.1 body-delivered action at the same probe</summary>
            <div class="table-wrap"><table class="method-table" data-testid="body-method-table">
              <thead><tr><th>Body route</th><th>W0</th><th>|W1|</th><th>error</th></tr></thead>
              <tbody id="body-method-body"></tbody>
            </table></div>
          </details>
        </aside>
      </section>

      <section class="analysis-grid a02-analysis-grid">
        <article class="card angular-card">
          <div class="section-head"><div><p class="eyebrow">ONE SILHOUETTE · TWO USES</p><h2>Full-sky deficit and H(Ω) thickness</h2></div><span>receiver-centred geometry</span></div>
          <canvas id="angular-map" width="760" height="380" data-testid="background-angular-map"></canvas>
          <p>Left: the body removes a cap from the 4π background in the opaque first-hit control. Right: the same cap carries a continuous chord thickness H(Ω) in the A0.1 body-volume integral.</p>
        </article>

        <article class="card profile-card">
          <div class="section-head"><div><p class="eyebrow">GEOMETRIC 1/r² IDENTITY</p><h2>Background residual and body W1</h2></div><span>surface-normalized</span></div>
          <canvas id="profile-chart" width="760" height="380" data-testid="background-profile-chart"></canvas>
          <div class="profile-legend a02-profile-legend"><span class="oracle">Background analytic</span><span class="curved">Background curved cap</span><span class="renderer">Background renderer</span><span class="volume">Body W1 analytic</span></div>
          <p class="hint">Coincidence here is an analytic sphere-geometry identity after separate normalizations. It is not a validation or a claim that BGF is light.</p>
        </article>
      </section>

      <section class="audit-card card">
        <div class="section-head">
          <div><p class="eyebrow">A0.2 FROZEN GATE</p><h2>Isotropic background straight-deficit ledger</h2></div>
          <span id="audit-status" class="audit-badge" data-testid="action-audit-status">RUNNING</span>
        </div>
        <div class="audit-metrics a02-audit-metrics" data-testid="action-audit-metrics">
          <div><span>Curved cap max</span><strong id="audit-curved"></strong></div>
          <div><span>Renderer first-hit max</span><strong id="audit-renderer"></strong></div>
          <div><span>Scalar closure max</span><strong id="audit-scalar"></strong></div>
          <div><span>Vector closure max</span><strong id="audit-vector"></strong></div>
          <div><span>Analytic 1/r² residual</span><strong id="audit-far"></strong></div>
          <div><span>Inherited A0.1 max</span><strong id="audit-body"></strong></div>
        </div>
        <p id="audit-verdict"></p>
        <div class="route-chain">
          <span>positive isotropic incident</span><b>→</b><span>curved body silhouette</span><b>→</b><span>positive surviving + deficit</span><b>→</b><span>directional residual</span><b>→</b><span>force remains blocked</span>
        </div>
      </section>
    </main>
  `;
}

export class ActionTransportAppA02 {
  private sphere: SphereModel = { radius: 1, density: 1 };
  private background: IsotropicBackgroundModel = { intensityPerSteradian: 1 };
  private extentInRadii = 4;
  private channel: DisplayChannel = "BG_DEFICIT";
  private showVectors = true;
  private rendererSamples = 4096;
  private probe: Vec3 = [1.8, 0, 0];
  private cubature: VolumeCubature = createVolumeCubature(this.sphere);

  private readonly fieldCanvas: HTMLCanvasElement;
  private readonly angularCanvas: HTMLCanvasElement;
  private readonly profileCanvas: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = createTemplate();
    required<HTMLElement>(root, "#action-commit").textContent = `commit ${APP_COMMIT.slice(0, 12)}`;
    this.fieldCanvas = required<HTMLCanvasElement>(root, "#field-map");
    this.angularCanvas = required<HTMLCanvasElement>(root, "#angular-map");
    this.profileCanvas = required<HTMLCanvasElement>(root, "#profile-chart");
    this.bindControls();
    this.renderAll();
  }

  private bindControls(): void {
    const radius = required<HTMLInputElement>(this.root, "#sphere-radius");
    const bodyDensity = required<HTMLInputElement>(this.root, "#body-density");
    const backgroundIntensity = required<HTMLInputElement>(this.root, "#background-intensity");
    const extent = required<HTMLInputElement>(this.root, "#map-extent");
    const channel = required<HTMLSelectElement>(this.root, "#display-channel");
    const vectors = required<HTMLInputElement>(this.root, "#show-vectors");
    const rendererSamples = required<HTMLSelectElement>(this.root, "#renderer-samples");

    radius.addEventListener("input", () => {
      this.sphere = { ...this.sphere, radius: Number(radius.value) };
      this.probe = [1.8 * this.sphere.radius, 0, 0];
      this.rebuildCubature();
      this.renderAll();
    });
    bodyDensity.addEventListener("input", () => {
      this.sphere = { ...this.sphere, density: Number(bodyDensity.value) };
      this.rebuildCubature();
      this.renderAll();
    });
    backgroundIntensity.addEventListener("input", () => {
      this.background = { intensityPerSteradian: Number(backgroundIntensity.value) };
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
      bodyDensity.value = "1";
      backgroundIntensity.value = "1";
      extent.value = "4";
      channel.value = "BG_DEFICIT";
      vectors.checked = true;
      rendererSamples.value = "4096";
      this.sphere = { radius: 1, density: 1 };
      this.background = { intensityPerSteradian: 1 };
      this.extentInRadii = 4;
      this.channel = "BG_DEFICIT";
      this.showVectors = true;
      this.rendererSamples = 4096;
      this.probe = [1.8, 0, 0];
      this.rebuildCubature();
      this.renderAll();
    });
    required<HTMLButtonElement>(this.root, "#export-receipt").addEventListener("click", () => this.exportReceipt());
    this.fieldCanvas.addEventListener("click", event => this.moveProbe(event));
  }

  private rebuildCubature(): void {
    this.cubature = createVolumeCubature(this.sphere);
  }

  private renderAll(): void {
    required<HTMLOutputElement>(this.root, "#sphere-radius-value").value = this.sphere.radius.toFixed(2);
    required<HTMLOutputElement>(this.root, "#body-density-value").value = this.sphere.density.toFixed(2);
    required<HTMLOutputElement>(this.root, "#background-intensity-value").value = this.background.intensityPerSteradian.toFixed(2);
    required<HTMLOutputElement>(this.root, "#map-extent-value").value = `±${this.extentInRadii.toFixed(2)} R`;
    this.renderFieldMap();
    this.renderProbePanel();
    this.renderAngularMap();
    const audit = this.calculateAudit();
    this.renderProfile(audit);
    this.renderAudit(audit);
  }

  private worldFromCanvas(canvasX: number, canvasY: number): Vec3 {
    const extent = this.extentInRadii * this.sphere.radius;
    return [
      (canvasX / this.fieldCanvas.width * 2 - 1) * extent,
      (1 - canvasY / this.fieldCanvas.height * 2) * extent,
      0,
    ];
  }

  private canvasFromWorld(point: Vec3): readonly [number, number] {
    const extent = this.extentInRadii * this.sphere.radius;
    return [
      (point[0] / extent + 1) * 0.5 * this.fieldCanvas.width,
      (1 - point[1] / extent) * 0.5 * this.fieldCanvas.height,
    ];
  }

  private moveProbe(event: MouseEvent): void {
    const bounds = this.fieldCanvas.getBoundingClientRect();
    const canvasX = (event.clientX - bounds.left) / bounds.width * this.fieldCanvas.width;
    const canvasY = (event.clientY - bounds.top) / bounds.height * this.fieldCanvas.height;
    let point = this.worldFromCanvas(canvasX, canvasY);
    const distance = magnitude(point);
    const minimum = 1.02 * this.sphere.radius;
    if (distance < minimum) {
      const direction: Vec3 = distance > 1e-12 ? [point[0] / distance, point[1] / distance, 0] : [1, 0, 0];
      point = [direction[0] * minimum, direction[1] * minimum, 0];
    }
    this.probe = point;
    this.renderAll();
  }

  private displayValue(point: Vec3): number {
    if (this.channel === "BODY_W0" || this.channel === "BODY_W1") {
      const body = analyticSphereOutside(point, this.sphere);
      return normalizedDisplayValue(body, this.sphere, this.channel === "BODY_W0" ? "W0" : "W1");
    }
    const ledger = analyticIsotropicSphereBackground(point, this.sphere, this.background);
    if (this.channel === "BG_DEFICIT") return ledger.deficitFraction / 0.25;
    if (this.channel === "BG_STRAIGHT") return (ledger.straightFraction - 0.75) / 0.25;
    return ledger.residualMagnitude / (Math.PI * this.background.intensityPerSteradian);
  }

  private directionalVector(point: Vec3): Vec3 {
    if (this.channel === "BODY_W0" || this.channel === "BODY_W1") {
      return analyticSphereOutside(point, this.sphere).w1;
    }
    return analyticIsotropicSphereBackground(point, this.sphere, this.background).residualFromDeficit;
  }

  private renderFieldMap(): void {
    const context = this.fieldCanvas.getContext("2d");
    if (!context) throw new Error("2D canvas unavailable");
    const gridSize = 230;
    const offscreen = document.createElement("canvas");
    offscreen.width = gridSize;
    offscreen.height = gridSize;
    const offscreenContext = offscreen.getContext("2d");
    if (!offscreenContext) throw new Error("Offscreen canvas unavailable");
    const image = offscreenContext.createImageData(gridSize, gridSize);
    const extent = this.extentInRadii * this.sphere.radius;

    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        const worldX = (column / (gridSize - 1) * 2 - 1) * extent;
        const worldY = (1 - row / (gridSize - 1) * 2) * extent;
        const distance = Math.hypot(worldX, worldY);
        const offset = 4 * (row * gridSize + column);
        if (distance <= this.sphere.radius * 1.002) {
          image.data[offset] = 7;
          image.data[offset + 1] = 10;
          image.data[offset + 2] = 15;
          image.data[offset + 3] = 255;
          continue;
        }
        const display = Math.sqrt(clamp01(this.displayValue([worldX, worldY, 0])));
        const [red, green, blue] = heatColor(display);
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
    context.strokeStyle = "rgba(219,236,228,0.17)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(this.fieldCanvas.width / 2, 0);
    context.lineTo(this.fieldCanvas.width / 2, this.fieldCanvas.height);
    context.moveTo(0, this.fieldCanvas.height / 2);
    context.lineTo(this.fieldCanvas.width, this.fieldCanvas.height / 2);
    context.stroke();

    const [centreX, centreY] = this.canvasFromWorld([0, 0, 0]);
    const pixelsPerUnit = this.fieldCanvas.width / (2 * extent);
    context.fillStyle = "rgba(8,11,16,0.94)";
    context.strokeStyle = "rgba(236,220,164,0.95)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centreX, centreY, this.sphere.radius * pixelsPerUnit, 0, Math.PI * 2);
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
    context.fillText("receiver", probeX + 10, probeY - 10);
    context.restore();

    const metadata: Record<DisplayChannel, { title: string; semantic: string; left: string; right: string; hint: string }> = {
      BG_DEFICIT: {
        title: "A0.2 · straight deficit fraction",
        semantic: "W0_deficit / W0_incident = Ωbody / 4π",
        left: "no blocked sky",
        right: "surface limit 0.25",
        hint: "Color shows what fraction of an otherwise isotropic positive background is removed from the straight channel by the sphere's curved silhouette.",
      },
      BG_STRAIGHT: {
        title: "A0.2 · straight surviving fraction",
        semantic: "W0_straight / W0_incident = 1 − Ωbody / 4π",
        left: "surface limit 0.75",
        right: "full straight sky 1.0",
        hint: "This is the positive scalar background that remains in the straight channel. Its directional sum is not zero after the cap is removed.",
      },
      BG_RESULTANT: {
        title: "A0.2 · residual from broken angular cancellation",
        semantic: "|W1_residual| / πI = (R/r)²",
        left: "far / weak",
        right: "surface-normalized 1.0",
        hint: "Arrows show the surviving directional residual toward the formed sphere. This is action geometry, not physical force.",
      },
      BODY_W0: {
        title: "A0.1 · body-delivered W0",
        semantic: "∫V q dV/r² = ∫S² Hq(Ω)dΩ",
        left: "far / weak",
        right: "surface-normalized 1.0",
        hint: "Color is the positive scalar straight-route action delivered by the formed body's full volume, including thickness H(Ω).",
      },
      BODY_W1: {
        title: "A0.1 · body-delivered |W1|",
        semantic: "|∫V q r̂ dV/r²|",
        left: "far / weak",
        right: "surface-normalized 1.0",
        hint: "Color is a compressed directional moment of the body-volume action map; arrows retain orientation.",
      },
    };
    const info = metadata[this.channel];
    required<HTMLElement>(this.root, "#map-title").textContent = info.title;
    required<HTMLElement>(this.root, "#map-semantic").textContent = info.semantic;
    required<HTMLElement>(this.root, "#legend-left").textContent = info.left;
    required<HTMLElement>(this.root, "#legend-right").textContent = info.right;
    required<HTMLElement>(this.root, "#map-hint").textContent = `${info.hint} Click outside the body to move the receiver.`;
  }

  private drawVectorField(context: CanvasRenderingContext2D): void {
    const extent = this.extentInRadii * this.sphere.radius;
    const spacing = 54;
    context.save();
    context.strokeStyle = "rgba(255,255,255,0.68)";
    context.fillStyle = "rgba(255,255,255,0.68)";
    context.lineWidth = 1.15;
    for (let pixelY = spacing / 2; pixelY < this.fieldCanvas.height; pixelY += spacing) {
      for (let pixelX = spacing / 2; pixelX < this.fieldCanvas.width; pixelX += spacing) {
        const point = this.worldFromCanvas(pixelX, pixelY);
        const distance = magnitude(point);
        if (distance <= 1.08 * this.sphere.radius || distance > extent) continue;
        const vector = this.directionalVector(point);
        const direction = normalizedDirection(vector);
        const strength = clamp01(this.displayValue(point));
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

  private backgroundMethods(probe: Vec3): BackgroundMethodResult[] {
    const analytic = analyticIsotropicSphereBackground(probe, this.sphere, this.background);
    const curved = curvedIsotropicSphereBackground(probe, this.sphere, this.background, 96);
    const renderer = rendererIsotropicSphereBackground(probe, this.sphere, this.background, this.rendererSamples);
    const make = (
      id: BackgroundMethodId,
      label: string,
      ledger: BackgroundLedger | RendererBackgroundLedger,
      detail: string,
    ): BackgroundMethodResult => ({
      id,
      label,
      ledger,
      scalarError: backgroundRelativeError(ledger.straightDeficitScalar, analytic.straightDeficitScalar),
      vectorError: backgroundRelativeError(ledger.residualMagnitude, analytic.residualMagnitude),
      detail,
    });
    return [
      make("ANALYTIC_CAP", "Analytic cap", analytic, "closed spherical-cap oracle"),
      make("CURVED_CAP", "Curved sphere", curved, "Gauss96 over actual cap"),
      make("RENDERER_FIRST_HIT", "Renderer first-hit", renderer, `${this.rendererSamples.toLocaleString()} broad-cone rays · ${(renderer as RendererBackgroundLedger).hitCount.toLocaleString()} hits`),
    ];
  }

  private bodyMethods(probe: Vec3): BodyMethodResult[] {
    const analytic = analyticSphereOutside(probe, this.sphere);
    const volume = distributedVolumeSphere(probe, this.sphere, this.cubature);
    const curved = curvedSolidAngleSphere(probe, this.sphere, 96);
    const renderer = rendererCapImportanceSphere(probe, this.sphere, Math.max(2048, this.rendererSamples));
    const make = (id: BodyMethodId, label: string, sample: FieldSample, detail: string): BodyMethodResult => ({
      id,
      label,
      sample,
      scalarError: relativeError(sample.w0, analytic.w0),
      vectorError: relativeError(sample.w1Magnitude, analytic.w1Magnitude),
      detail,
    });
    return [
      make("ANALYTIC_BODY", "Analytic body", analytic, "closed exterior oracle"),
      make("SMALL_BODIES", "Small bodies", volume, `${this.cubature.points.length.toLocaleString()} equal-volume samples`),
      make("CURVED_H_OMEGA", "Curved H(Ω)", curved, "Gauss96 + exact chord"),
      make("RENDERER_CHORDS", "Renderer chords", renderer, `${Math.max(2048, this.rendererSamples).toLocaleString()} cap rays`),
    ];
  }

  private renderProbePanel(): void {
    const distance = magnitude(this.probe);
    const ratio = distance / this.sphere.radius;
    const backgroundMethods = this.backgroundMethods(this.probe);
    const analyticBackground = backgroundMethods[0];
    if (!analyticBackground) throw new Error("Missing analytic background result");
    const ledger = analyticBackground.ledger;
    const direction = normalizedDirection(ledger.residualFromDeficit);

    required<HTMLElement>(this.root, "#probe-position").textContent = `receiver = (${(this.probe[0] / this.sphere.radius).toFixed(3)}, ${(this.probe[1] / this.sphere.radius).toFixed(3)}, 0) R`;
    required<HTMLElement>(this.root, "#bg-incident").textContent = format(ledger.incidentScalar);
    required<HTMLElement>(this.root, "#bg-surviving").textContent = format(ledger.straightSurvivingScalar);
    required<HTMLElement>(this.root, "#bg-deficit").textContent = format(ledger.straightDeficitScalar);
    required<HTMLElement>(this.root, "#bg-deficit-fraction").textContent = formatPercent(ledger.deficitFraction);
    required<HTMLElement>(this.root, "#bg-resultant").textContent = format(ledger.residualMagnitude);
    required<HTMLElement>(this.root, "#bg-direction").textContent = `(${direction[0].toFixed(3)}, ${direction[1].toFixed(3)}, ${direction[2].toFixed(3)})`;
    required<HTMLElement>(this.root, "#bg-scalar-closure").textContent = format(ledger.scalarClosureResidual);
    required<HTMLElement>(this.root, "#bg-vector-closure").textContent = format(ledger.vectorClosureResidual);

    required<HTMLTableSectionElement>(this.root, "#background-method-body").innerHTML = backgroundMethods.map(method => `
      <tr data-method="${method.id}">
        <td><strong>${method.label}</strong><small>${method.detail}</small></td>
        <td>${format(method.ledger.straightDeficitScalar)}</td>
        <td>${format(method.ledger.residualMagnitude)}</td>
        <td>${method.id === "ANALYTIC_CAP" ? "reference" : formatPercent(Math.max(method.scalarError, method.vectorError))}</td>
      </tr>
    `).join("");

    const bodyMethods = this.bodyMethods(this.probe);
    required<HTMLTableSectionElement>(this.root, "#body-method-body").innerHTML = bodyMethods.map(method => `
      <tr data-method="${method.id}">
        <td><strong>${method.label}</strong><small>${method.detail}</small></td>
        <td>${format(method.sample.w0)}</td>
        <td>${format(method.sample.w1Magnitude)}</td>
        <td>${method.id === "ANALYTIC_BODY" ? "reference" : formatPercent(Math.max(method.scalarError, method.vectorError))}</td>
      </tr>
    `).join("");

    required<HTMLElement>(this.root, "#probe-position").dataset.ratio = ratio.toFixed(6);
  }

  private renderAngularMap(): void {
    const context = this.angularCanvas.getContext("2d");
    if (!context) throw new Error("Angular canvas unavailable");
    const width = this.angularCanvas.width;
    const height = this.angularCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#07100f";
    context.fillRect(0, 0, width, height);

    const distance = magnitude(this.probe);
    const alpha = Math.asin(this.sphere.radius / distance);
    const capSolidAngle = 2 * Math.PI * (1 - Math.cos(alpha));

    const skyX = width * 0.25;
    const centreY = height * 0.5;
    const skyRadius = Math.min(height * 0.39, width * 0.19);
    const capRadius = Math.max(2.5, skyRadius * alpha / Math.PI);
    const skyGradient = context.createRadialGradient(skyX, centreY, 0, skyX, centreY, skyRadius);
    skyGradient.addColorStop(0, "#16394d");
    skyGradient.addColorStop(1, "#08131f");
    context.fillStyle = skyGradient;
    context.beginPath();
    context.arc(skyX, centreY, skyRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(194,222,213,0.55)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "rgba(236,194,104,0.95)";
    context.beginPath();
    context.arc(skyX, centreY, capRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,235,185,0.95)";
    context.stroke();
    context.fillStyle = "rgba(220,236,230,0.85)";
    context.font = "13px system-ui, sans-serif";
    context.fillText("4π isotropic incident sky", skyX - skyRadius, 28);
    context.fillText("blocked first-hit cap", skyX - 70, centreY + capRadius + 24);

    const capX = width * 0.72;
    const zoomRadius = Math.min(height * 0.35, width * 0.15);
    const profile = chordProfile(distance, this.sphere, 160);
    const chordGradient = context.createRadialGradient(capX, centreY, 0, capX, centreY, zoomRadius);
    for (const item of profile) {
      const [red, green, blue] = heatColor(Math.sqrt(clamp01(item.chord / (2 * this.sphere.radius))));
      chordGradient.addColorStop(item.radialFraction, `rgb(${red} ${green} ${blue})`);
    }
    context.fillStyle = chordGradient;
    context.beginPath();
    context.arc(capX, centreY, zoomRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,235,185,0.95)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "rgba(220,236,230,0.85)";
    context.fillText("same cap, zoomed H(Ω)", capX - 78, 28);

    context.fillStyle = "rgba(174,199,191,0.82)";
    context.font = "12px ui-monospace, monospace";
    context.fillText(`α = ${(alpha * 180 / Math.PI).toFixed(4)}°`, width * 0.43, 108);
    context.fillText(`Ωbody = ${format(capSolidAngle)} sr`, width * 0.43, 139);
    context.fillText(`Ωbody / 4π = ${formatPercent(capSolidAngle / (4 * Math.PI))}`, width * 0.43, 170);
    context.fillText(`Hmax = ${(2 * this.sphere.radius).toFixed(4)}`, width * 0.43, 201);
    context.fillText("A0.2 uses silhouette", width * 0.43, 248);
    context.fillText("A0.1 uses thickness", width * 0.43, 275);
  }

  private calculateAudit(): AuditResult {
    const rows = FROZEN_DISTANCES.map(distanceRatio => {
      const probe: Vec3 = [distanceRatio * this.sphere.radius, 0, 0];
      return {
        distanceRatio,
        analytic: analyticIsotropicSphereBackground(probe, this.sphere, this.background),
        curved: curvedIsotropicSphereBackground(probe, this.sphere, this.background, 96),
        renderer: rendererIsotropicSphereBackground(probe, this.sphere, this.background, this.rendererSamples),
        body: analyticSphereOutside(probe, this.sphere),
      };
    });

    let maximumCurvedError = 0;
    let maximumRendererError = 0;
    let maximumScalarClosure = 0;
    let maximumVectorClosure = 0;
    let farLawResidual = 0;
    let inheritedBodyMaximumError = 0;

    for (const row of rows) {
      maximumCurvedError = Math.max(
        maximumCurvedError,
        backgroundRelativeError(row.curved.straightDeficitScalar, row.analytic.straightDeficitScalar),
        backgroundRelativeError(row.curved.residualMagnitude, row.analytic.residualMagnitude),
      );
      maximumRendererError = Math.max(
        maximumRendererError,
        backgroundRelativeError(row.renderer.straightDeficitScalar, row.analytic.straightDeficitScalar),
        backgroundRelativeError(row.renderer.residualMagnitude, row.analytic.residualMagnitude),
      );
      maximumScalarClosure = Math.max(
        maximumScalarClosure,
        row.analytic.scalarClosureResidual,
        row.curved.scalarClosureResidual,
        row.renderer.scalarClosureResidual,
      );
      maximumVectorClosure = Math.max(
        maximumVectorClosure,
        row.analytic.vectorClosureResidual,
        row.curved.vectorClosureResidual,
        row.renderer.vectorClosureResidual,
      );
      const expectedBackground = Math.PI * this.background.intensityPerSteradian / row.distanceRatio ** 2;
      farLawResidual = Math.max(
        farLawResidual,
        backgroundRelativeError(row.analytic.residualMagnitude, expectedBackground),
      );

      const probe: Vec3 = [row.distanceRatio * this.sphere.radius, 0, 0];
      const bodyCurved = curvedSolidAngleSphere(probe, this.sphere, 96);
      const bodyRenderer = rendererCapImportanceSphere(probe, this.sphere, Math.max(2048, this.rendererSamples));
      inheritedBodyMaximumError = Math.max(
        inheritedBodyMaximumError,
        relativeError(bodyCurved.w0, row.body.w0),
        relativeError(bodyCurved.w1Magnitude, row.body.w1Magnitude),
        relativeError(bodyRenderer.w0, row.body.w0),
        relativeError(bodyRenderer.w1Magnitude, row.body.w1Magnitude),
      );
    }

    const status = maximumCurvedError <= 2e-10
      && maximumRendererError <= 5e-4
      && maximumScalarClosure <= 1e-12
      && maximumVectorClosure <= 1e-12
      && farLawResidual <= 1e-12
      && inheritedBodyMaximumError <= 2e-4
      ? "PASS"
      : "BLOCKED";

    return {
      maximumCurvedError,
      maximumRendererError,
      maximumScalarClosure,
      maximumVectorClosure,
      farLawResidual,
      inheritedBodyMaximumError,
      status,
      rows,
    };
  }

  private renderProfile(audit: AuditResult): void {
    const context = this.profileCanvas.getContext("2d");
    if (!context) throw new Error("Profile canvas unavailable");
    const width = this.profileCanvas.width;
    const height = this.profileCanvas.height;
    const margin = { left: 60, right: 20, top: 28, bottom: 44 };
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
      context.fillText(`10^${(-tick * 0.5).toFixed(1)}`, 7, y + 4);
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
    const yOf = (value: number) => margin.top + (-Math.log10(Math.max(1e-3, value)) / 2) * plotHeight;
    const drawSeries = (values: number[], stroke: string, lineWidth: number, dashed = false) => {
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.setLineDash(dashed ? [7, 5] : []);
      context.beginPath();
      audit.rows.forEach((row, index) => {
        const value = values[index];
        if (value === undefined) return;
        const x = xOf(row.distanceRatio);
        const y = yOf(value);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
      context.setLineDash([]);
    };
    const normalizeBackground = (ledger: BackgroundLedger) => ledger.residualMagnitude / (Math.PI * this.background.intensityPerSteradian);
    const normalizeBody = (sample: FieldSample) => sample.w1Magnitude / ((4 / 3) * Math.PI * this.sphere.density * this.sphere.radius);
    drawSeries(audit.rows.map(row => normalizeBackground(row.analytic)), "#f4e4ad", 3.5);
    drawSeries(audit.rows.map(row => normalizeBackground(row.curved)), "#8aa7ff", 2);
    drawSeries(audit.rows.map(row => normalizeBackground(row.renderer)), "#ef8f70", 2);
    drawSeries(audit.rows.map(row => normalizeBody(row.body)), "#67bda8", 2, true);
    context.fillStyle = "rgba(220,235,228,0.84)";
    context.fillText("surface-normalized magnitude (log)", 8, 17);
  }

  private renderAudit(audit: AuditResult): void {
    const status = required<HTMLElement>(this.root, "#audit-status");
    status.textContent = audit.status === "PASS" ? "A0.2 LEDGER PASS" : "A0.2 BLOCKED";
    status.className = `audit-badge ${audit.status === "PASS" ? "pass" : "blocked"}`;
    required<HTMLElement>(this.root, "#audit-curved").textContent = formatPercent(audit.maximumCurvedError);
    required<HTMLElement>(this.root, "#audit-renderer").textContent = formatPercent(audit.maximumRendererError);
    required<HTMLElement>(this.root, "#audit-scalar").textContent = format(audit.maximumScalarClosure);
    required<HTMLElement>(this.root, "#audit-vector").textContent = format(audit.maximumVectorClosure);
    required<HTMLElement>(this.root, "#audit-far").textContent = formatPercent(audit.farLawResidual);
    required<HTMLElement>(this.root, "#audit-body").textContent = formatPercent(audit.inheritedBodyMaximumError);
    required<HTMLElement>(this.root, "#audit-verdict").textContent = audit.status === "PASS"
      ? "A0_2_ISOTROPIC_BACKGROUND_STRAIGHT_DEFICIT_LEDGER_PASS. The analytic cap, curved-sphere integration and renderer first-hit route agree on the frozen exterior-sphere corridor. This is a geometry and visualization result only."
      : "A0.2 is blocked at the current settings. No tolerance is loosened and no physical interpretation is promoted.";
  }

  private exportReceipt(): void {
    const backgroundMethods = this.backgroundMethods(this.probe);
    const bodyMethods = this.bodyMethods(this.probe);
    const audit = this.calculateAudit();
    const receipt = {
      receipt_version: "A0.2",
      app_commit: APP_COMMIT,
      generated_at: new Date().toISOString(),
      fixture: {
        type: "FORMED_UNIFORM_SPHERE_WITH_ISOTROPIC_BACKGROUND_EXTERIOR_RECEIVER",
        sphere: this.sphere,
        background: this.background,
        receiver_probe: this.probe,
        straight_routes_only: true,
        opaque_first_hit_control: true,
      },
      semantics: {
        a0_1_body_W0: "POSITIVE_SCALAR_ACTION_DELIVERED_BY_FORMED_BODY_VOLUME",
        a0_1_body_W1: "DIRECTIONAL_FIRST_MOMENT_OF_BODY_DELIVERED_ACTION",
        a0_2_incident: "POSITIVE_ISOTROPIC_ACTION_PER_STERADIAN_INTEGRATED_OVER_4PI",
        a0_2_straight_surviving: "POSITIVE_INCIDENT_ACTION_REMAINING_AFTER_BODY_SILHOUETTE",
        a0_2_straight_deficit: "POSITIVE_INCIDENT_ACTION_REMOVED_FROM_STRAIGHT_CHANNEL",
        a0_2_residual: "DIRECTIONAL_SURVIVING_MOMENT_FROM_BROKEN_ANTIPODAL_CANCELLATION",
        physical_force_available: false,
        final_opacity_law_selected: false,
      },
      background_methods: backgroundMethods,
      body_methods: bodyMethods,
      audit: {
        status: audit.status,
        maximum_curved_error: audit.maximumCurvedError,
        maximum_renderer_error: audit.maximumRendererError,
        maximum_scalar_closure: audit.maximumScalarClosure,
        maximum_vector_closure: audit.maximumVectorClosure,
        far_law_residual: audit.farLawResidual,
        inherited_body_maximum_error: audit.inheritedBodyMaximumError,
      },
      firewalls: [
        "NO_LIGHT_IDENTITY_CLAIM",
        "NO_OPAQUE_LIMIT_AUTO_PROMOTION",
        "NO_FIELD_DENSITY_CLAIM",
        "NO_PHYSICAL_FORCE",
        "NO_CADENCE_BINDING",
        "NO_SCALE_BINDING",
        "NO_GRIN_PHYSICAL_LAW",
        "NO_LUXCORE_OPERATOR_IMPORT",
        "NO_VALIDATION",
        "NO_CANON_PROMOTION",
      ],
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "VOXELLAB_ACTION_TRANSPORT_A0_2_RECEIPT.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
}
