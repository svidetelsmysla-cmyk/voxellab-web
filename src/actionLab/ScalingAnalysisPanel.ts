import { frameVolume, loadEquilibriumPacket } from "./equilibriumGpu/packetLoader";
import { findQualifiedRoots, sampleResponse } from "./equilibriumGpu/cpuReference";
import type { ClosureMode, LoadedEquilibriumPacket, Vec3, VolumeFrame } from "./equilibriumGpu/types";
import {
  fitPowerLaw,
  hierarchyDimension,
  localPowerExponent,
  R15_Q_CRIT,
  R15_R_CRIT,
  r15Extrema,
  r15FoldScaling,
  shellActionExponent,
} from "./scalingAnalysis";
import {
  buildScaleDimensionProfile,
  compensationFraction,
  localScalingDimension,
  outerStableMean,
  type RadialMatterSample,
} from "./scaleDimension";

const PACKET_URL = `${import.meta.env.BASE_URL}packets/webgpu-equilibrium-regime-map-v1`;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const n = Math.max(norm(a), 1e-30);
  return [a[0] / n, a[1] / n, a[2] / n];
};
const addScaled = (p: Vec3, a: Vec3, s: number): Vec3 => [
  p[0] + a[0] * s,
  p[1] + a[1] * s,
  p[2] + a[2] * s,
];

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing scale-law element ${selector}`);
  return value;
}

function clear(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function axes(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  xLabel: string,
  yLabel: string,
) {
  ctx.strokeStyle = "rgba(210,230,240,.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, box.y);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.stroke();
  ctx.fillStyle = "rgba(220,235,244,.72)";
  ctx.font = "12px system-ui";
  ctx.fillText(xLabel, box.x + box.w - 80, box.y + box.h + 25);
  ctx.save();
  ctx.translate(box.x - 42, box.y + 70);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function plotLine(
  ctx: CanvasRenderingContext2D,
  xs: readonly number[],
  ys: readonly number[],
  box: { x: number; y: number; w: number; h: number },
  color: string,
  yMin?: number,
  yMax?: number,
  logX = false,
  logY = false,
  lineWidth = 2,
) {
  const pairs = xs
    .map((x, i) => [x, ys[i]!] as const)
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!logX || x > 0) && (!logY || y > 0));
  if (pairs.length < 2) return;
  const tx = pairs.map(([x]) => (logX ? Math.log10(x) : x));
  const ty = pairs.map(([, y]) => (logY ? Math.log10(y) : y));
  const xmin = Math.min(...tx), xmax = Math.max(...tx);
  const ymin = yMin ?? Math.min(...ty), ymax = yMax ?? Math.max(...ty);
  const X = (x: number) => box.x + (x - xmin) / Math.max(xmax - xmin, 1e-30) * box.w;
  const Y = (y: number) => box.y + box.h - (y - ymin) / Math.max(ymax - ymin, 1e-30) * box.h;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  pairs.forEach(([x, y], i) => {
    const xx = X(logX ? Math.log10(x) : x);
    const yy = Y(logY ? Math.log10(y) : y);
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();
}

function canonicalCoordinate(value: number, low: number, length: number) {
  return low + (((value - low) % length) + length) % length;
}

function canonicalRegisteredCenter(frame: VolumeFrame, source: Vec3): Vec3 {
  return source.map((value, axis) => (
    canonicalCoordinate(value, frame.origin[axis]!, frame.dimensions[axis]! * frame.spacing[axis]!)
  )) as unknown as Vec3;
}

function periodicDifference(value: number, center: number, length: number) {
  const d = value - center;
  return d - Math.round(d / length) * length;
}

function gridPoint(frame: VolumeFrame, x: number, y: number, z: number): Vec3 {
  return [
    frame.origin[0] + x * frame.spacing[0],
    frame.origin[1] + y * frame.spacing[1],
    frame.origin[2] + z * frame.spacing[2],
  ];
}

function matterSamples(
  frame: VolumeFrame,
  reference: VolumeFrame,
  center: Vec3,
): RadialMatterSample[] {
  const rho = frame.rho!;
  const rhoReference = reference.rho!;
  const [nx, ny, nz] = frame.dimensions;
  const lengths = frame.dimensions.map((n, axis) => n * frame.spacing[axis]!) as [number, number, number];
  const samples: RadialMatterSample[] = [];
  for (let z = 0; z < nz; z += 1) for (let y = 0; y < ny; y += 1) for (let x = 0; x < nx; x += 1) {
    const p = gridPoint(frame, x, y, z);
    const dx = periodicDifference(p[0], center[0], lengths[0]);
    const dy = periodicDifference(p[1], center[1], lengths[1]);
    const dz = periodicDifference(p[2], center[2], lengths[2]);
    const i = (z * ny + y) * nx + x;
    samples.push({
      radius: Math.hypot(dx, dy, dz),
      rho: rho[i]!,
      rhoReference: rhoReference[i]!,
    });
  }
  return samples;
}

function materialScaleProfile(frame: VolumeFrame, reference: VolumeFrame, center: Vec3) {
  const lengths = frame.dimensions.map((n, axis) => n * frame.spacing[axis]!) as [number, number, number];
  const rMin = Math.max(...frame.spacing) * 0.85;
  const rMax = 0.46 * Math.min(...lengths);
  const radii = Array.from({ length: 38 }, (_, i) => rMin * (rMax / rMin) ** (i / 37));
  const dV = frame.spacing[0] * frame.spacing[1] * frame.spacing[2];
  return buildScaleDimensionProfile(matterSamples(frame, reference, center), radii, dV);
}

function rayLimit(frame: VolumeFrame, center: Vec3, axis: Vec3, sign: number) {
  let limit = Infinity;
  for (let k = 0; k < 3; k += 1) {
    const a = axis[k]! * sign;
    if (Math.abs(a) < 1e-12) continue;
    const low = frame.origin[k]!;
    const high = low + (frame.dimensions[k]! - 1) * frame.spacing[k]!;
    const t = a > 0 ? (high - center[k]!) / a : (low - center[k]!) / a;
    if (t > 0) limit = Math.min(limit, t);
  }
  return limit;
}

function responsePowerProfile(frame: VolumeFrame, center: Vec3, axis0: Vec3) {
  const axis = unit(axis0);
  const lengths = frame.dimensions.map((n, i) => n * frame.spacing[i]!) as [number, number, number];
  const periodicLimit = 0.45 * Math.min(...lengths);
  const finiteLimit = 0.84 * Math.min(rayLimit(frame, center, axis, +1), rayLimit(frame, center, axis, -1));
  const rMax = frame.periodic ? periodicLimit : finiteLimit;
  const rMin = Math.max(0.8 * Math.min(...frame.spacing), 0.5);
  if (!(rMax > rMin * 1.15)) return { radii: [], amplitude: [], pEff: [], rMax };
  const radii = Array.from({ length: 72 }, (_, i) => rMin * (rMax / rMin) ** (i / 71));
  const amplitude = radii.map((r) => {
    const plus = sampleResponse(frame, addScaled(center, axis, r));
    const minus = sampleResponse(frame, addScaled(center, axis, -r));
    return 0.5 * (Math.abs(dot(plus, axis)) + Math.abs(dot(minus, axis)));
  });
  return { radii, amplitude, pEff: localPowerExponent(radii, amplitude), rMax };
}

function fibonacciDirections(count = 96): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - 2 * (i + 0.5) / count;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = golden * i;
    return [Math.cos(phi) * radius, y, Math.sin(phi) * radius] as Vec3;
  });
}

function finiteShellLimit(frame: VolumeFrame, center: Vec3) {
  let limit = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const low = frame.origin[axis]!;
    const high = low + (frame.dimensions[axis]! - 1) * frame.spacing[axis]!;
    limit = Math.min(limit, center[axis]! - low, high - center[axis]!);
  }
  return 0.82 * limit;
}

function shellAngularProfile(frame: VolumeFrame, center: Vec3) {
  const lengths = frame.dimensions.map((n, i) => n * frame.spacing[i]!) as [number, number, number];
  const rMin = Math.max(...frame.spacing) * 1.05;
  const rMax = frame.periodic ? 0.43 * Math.min(...lengths) : finiteShellLimit(frame, center);
  if (!(rMax > rMin * 1.2)) return { radii: [], p1: [], p2: [], exponent1: [], exponent2: [] };
  const radii = Array.from({ length: 30 }, (_, i) => rMin * (rMax / rMin) ** (i / 29));
  const directions = fibonacciDirections();
  const p1: number[] = [];
  const p2: number[] = [];

  for (const r of radii) {
    let denominator = 0;
    const dip = [0, 0, 0];
    const quad = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const n of directions) {
      const response = sampleResponse(frame, addScaled(center, n, r));
      const s = dot(response, n);
      denominator += Math.abs(s);
      for (let a = 0; a < 3; a += 1) {
        dip[a] = dip[a]! + s * n[a]!;
        for (let b = 0; b < 3; b += 1) {
          const basis = n[a]! * n[b]! - (a === b ? 1 / 3 : 0);
          quad[a]![b] = quad[a]![b]! + s * basis;
        }
      }
    }
    denominator = Math.max(denominator / directions.length, 1e-30);
    const dipNorm = Math.hypot(...dip.map((v) => v / directions.length));
    let q2 = 0;
    for (const row of quad) for (const value of row) q2 += (value / directions.length) ** 2;
    p1.push(dipNorm / denominator);
    p2.push(Math.sqrt(q2) / denominator);
  }
  return {
    radii,
    p1,
    p2,
    exponent1: localScalingDimension(radii, p1),
    exponent2: localScalingDimension(radii, p2),
  };
}

function distanceToCenter(frame: VolumeFrame, p: Vec3, center: Vec3) {
  if (!frame.periodic) return Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]);
  const lengths = frame.dimensions.map((n, i) => n * frame.spacing[i]!) as [number, number, number];
  return Math.hypot(
    periodicDifference(p[0], center[0], lengths[0]),
    periodicDifference(p[1], center[1], lengths[1]),
    periodicDifference(p[2], center[2], lengths[2]),
  );
}

function nearestRootSoftness(frame: VolumeFrame, frameIndex: number, center: Vec3) {
  const roots = findQualifiedRoots(frame, frameIndex);
  if (!roots.length) return null;
  roots.sort((a, b) => distanceToCenter(frame, a.position, center) - distanceToCenter(frame, b.position, center));
  const root = roots[0]!;
  const soft = [...root.stiffnessEigenvalues].sort((a, b) => Math.abs(a) - Math.abs(b))[0]!;
  return { root, soft };
}

export class ScalingAnalysisPanel {
  private packet?: LoadedEquilibriumPacket;
  private frameIndex = 35;
  private closure: ClosureMode = "NEAREST_PERIODIC";
  private readonly dimensionCanvas: HTMLCanvasElement;
  private readonly powerCanvas: HTMLCanvasElement;
  private readonly foldCanvas: HTMLCanvasElement;
  private readonly modalCanvas: HTMLCanvasElement;
  private readonly hierarchyCanvas: HTMLCanvasElement;
  private readonly status: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <section class="scale-law-card" id="action-lab-scale-law-explorer-v1">
        <header class="scale-law-header">
          <div><p class="scale-law-kicker">R6 ANALYTIC MODE · V14H/V14J + R15 HOLDOUT</p><h2>Scale Law Explorer · V2</h2>
          <p>Separate background filling, localized relief, angular persistence and critical branch birth.</p></div>
          <span class="scale-law-ceiling">DIAGNOSTIC / PROJECT HYPOTHESIS · NO NEW FORCE LAW</span>
        </header>
        <div class="scale-law-firewall"><b>R17 correction:</b> do not explain a measured gain with a fitted η. Material dimension, angular persistence and mechanical softness are measured independently. Current angular/stiffness channels remain ACTION READOUTS, not total physical force.</div>
        <div class="scale-law-controls">
          <label>V14H frame <input id="scale-frame" type="range" min="0" max="35" step="1" value="35"><output id="scale-frame-label">t=70</output></label>
          <label>Response closure <select id="scale-closure"><option value="FINITE_BOX">finite box</option><option value="NEAREST_PERIODIC" selected>nearest periodic</option></select></label>
          <label>R15 q <input id="scale-r15-q" type="range" min="2.0" max="3.5" step="0.005" value="2.35"><output id="scale-r15-q-label">2.350</output></label>
        </div>
        <div class="scale-law-grid">
          <article><h3>1 · Scale-dimension curve</h3><p>Real V14H matter against frozen t=0 reference. Full amount and structural relief are different objects.</p><canvas id="scale-dimension" width="690" height="330"></canvas><div id="scale-dimension-readout" class="scale-readout"></div></article>
          <article><h3>2 · Local power exponent</h3><p>p<sub>eff</sub>(r)=−d ln|R|/d ln r along the registered branch axis. A far inverse-square channel would approach p=2.</p><canvas id="scale-power" width="690" height="330"></canvas><div id="scale-power-readout" class="scale-readout"></div></article>
          <article><h3>3 · Measured angular persistence</h3><p>Dimensionless shell moments of the radial ACTION READOUT. A scale-marginal normalized mode has d ln P<sub>l</sub>/d ln R≈0.</p><canvas id="scale-modal" width="690" height="330"></canvas><div id="scale-modal-readout" class="scale-readout"></div></article>
          <article><h3>4 · R15 critical fold</h3><p>Internal characteristic geometry: q crosses q<sub>crit</sub>. This is critical branch scaling, not the far 1/r² law.</p><canvas id="scale-fold" width="690" height="330"></canvas><div id="scale-fold-readout" class="scale-readout"></div></article>
          <article class="scale-hierarchy"><h3>5 · Inter-level hypothesis calculator</h3><p>Not evidence. It only shows how multiplicative level ratios become a power law after eliminating the hidden level index.</p>
            <div class="scale-mini-controls"><label>count ratio m <input id="scale-m" type="range" min="1.1" max="16" step="0.1" value="4"><output id="scale-m-label">4.0</output></label><label>length ratio b <input id="scale-b" type="range" min="1.1" max="6" step="0.1" value="2"><output id="scale-b-label">2.0</output></label><label>independent quality η <input id="scale-eta" type="range" min="-2" max="2" step="0.05" value="0"><output id="scale-eta-label">0.00</output></label></div>
            <canvas id="scale-hierarchy" width="690" height="330"></canvas><div id="scale-hierarchy-readout" class="scale-readout"></div>
          </article>
          <article><h3>6 · Frontier coincidence test</h3><p>The hypothesis becomes physical only when independently measured channels meet.</p>
            <div class="scale-law-thesis">
              <b>Within one level:</b> κ<sub>soft</sub>→0 → branch topology can change.<br>
              <b>Across scale:</b> normalized angular mode exponent →0 → the mode stops fading under coarse-graining.<br>
              <b>Next-level evidence:</b> repeated natural events must show scale collapse and stable daughter-separation / parent-scale ratios.
            </div>
            <div id="scale-frontier-readout" class="scale-readout"></div>
          </article>
        </div>
        <div class="scale-law-thesis"><b>Strong test:</b> a new level is supported only if micro-detail is lost while a dimensionless relational pattern survives. When R17 produces natural birth/split/merge events, overlay rescaled ρ-shape, angular modes and true total-force equilibrium topology; also test log-periodic residuals for discrete scale invariance.</div>
        <div id="scale-law-status" class="scale-law-status">loading governed packet…</div>
      </section>`;
    this.dimensionCanvas = required(root, "#scale-dimension");
    this.powerCanvas = required(root, "#scale-power");
    this.modalCanvas = required(root, "#scale-modal");
    this.foldCanvas = required(root, "#scale-fold");
    this.hierarchyCanvas = required(root, "#scale-hierarchy");
    this.status = required(root, "#scale-law-status");
    this.bind();
    this.drawFold();
    this.drawHierarchy();
    void this.initialize();
  }

  private bind() {
    required<HTMLInputElement>(this.root, "#scale-frame").addEventListener("input", (event) => {
      this.frameIndex = Number((event.currentTarget as HTMLInputElement).value);
      this.renderSourcePanels();
    });
    required<HTMLSelectElement>(this.root, "#scale-closure").addEventListener("change", (event) => {
      this.closure = (event.currentTarget as HTMLSelectElement).value as ClosureMode;
      this.renderSourcePanels();
    });
    required<HTMLInputElement>(this.root, "#scale-r15-q").addEventListener("input", (event) => {
      required<HTMLOutputElement>(this.root, "#scale-r15-q-label").value = Number((event.currentTarget as HTMLInputElement).value).toFixed(3);
      this.drawFold();
    });
    for (const id of ["#scale-m", "#scale-b", "#scale-eta"]) {
      required<HTMLInputElement>(this.root, id).addEventListener("input", () => this.drawHierarchy());
    }
  }

  private async initialize() {
    try {
      this.packet = await loadEquilibriumPacket(PACKET_URL);
      this.status.innerHTML = `<b>PACKET VERIFIED</b> · ${this.packet.manifest.packet_id} · source ${this.packet.manifest.grid.dimensions.join("×")} · ${this.packet.manifest.source.claim_ceiling}`;
      this.renderSourcePanels();
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  private renderSourcePanels() {
    if (!this.packet) return;
    const frame = frameVolume(this.packet, this.frameIndex, this.closure);
    const reference = frameVolume(this.packet, 0, "NEAREST_PERIODIC");
    const center = canonicalRegisteredCenter(frame, this.packet.manifest.registered_geometry.origin);
    required<HTMLOutputElement>(this.root, "#scale-frame-label").value = `t=${this.packet.manifest.times[this.frameIndex]!.toFixed(1)}`;
    this.drawDimension(frame, reference, center);
    this.drawPower(frame, center);
    this.drawModal(frame, center);
  }

  private drawDimension(frame: VolumeFrame, reference: VolumeFrame, center: Vec3) {
    const profile = materialScaleProfile(frame, reference, center);
    const ctx = clear(this.dimensionCanvas);
    const box = { x: 62, y: 22, w: 595, h: 245 };
    axes(ctx, box, "log R", "D_eff = d ln M / d ln R");
    const clean = (x: readonly number[]) => x.map((v) => Number.isFinite(v) && Math.abs(v) < 8 ? v : Number.NaN);
    plotLine(ctx, profile.radii, clean(profile.dVolume), box, "#68808d", -1, 5, true);
    plotLine(ctx, profile.radii, clean(profile.dAmount), box, "#55d6b3", -1, 5, true);
    plotLine(ctx, profile.radii, clean(profile.dRelief), box, "#f2c76b", -1, 5, true);
    plotLine(ctx, profile.radii, clean(profile.dPlus), box, "#f08b6e", -1, 5, true, false, 1.4);
    plotLine(ctx, profile.radii, clean(profile.dMinus), box, "#78b8ff", -1, 5, true, false, 1.4);
    const y3 = box.y + box.h - (3 - (-1)) / 6 * box.h;
    ctx.strokeStyle = "rgba(180,210,230,.35)";
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(box.x, y3); ctx.lineTo(box.x + box.w, y3); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#55d6b3"; ctx.fillText("amount", 75, 38);
    ctx.fillStyle = "#f2c76b"; ctx.fillText("total relief", 140, 38);
    ctx.fillStyle = "#f08b6e"; ctx.fillText("M+", 235, 38);
    ctx.fillStyle = "#78b8ff"; ctx.fillText("M−", 280, 38);
    ctx.fillStyle = "#899ca5"; ctx.fillText("sample volume", 325, 38);

    const dAmount = outerStableMean(profile.dAmount);
    const dRelief = outerStableMean(profile.dRelief);
    const hAbs = outerStableMean(profile.hMeanAbs);
    const hRms = outerStableMean(profile.hRms);
    const last = profile.radii.length - 1;
    const plus = profile.mPlus[last]!, minus = profile.mMinus[last]!;
    const comp = compensationFraction(plus, minus);
    required(this.root, "#scale-dimension-readout").innerHTML =
      `periodic material geometry · outer D<sub>amount</sub>≈${dAmount.toFixed(3)} · D<sub>relief</sub>≈${dRelief.toFixed(3)} · h<sub>|δρ|</sub>≈${hAbs.toFixed(3)} · h<sub>rms</sub>≈${hRms.toFixed(3)}<br>` +
      `M+≈${plus.toExponential(3)} · M−≈${minus.toExponential(3)} · outer compensation mismatch=${(100 * comp).toFixed(2)}%<br>` +
      `<small>D_amount≈3 means background volume filling. A localized finite relief tends toward D_relief≈0 after it is enclosed; then mean |δρ| dilutes roughly as R⁻³ and RMS relief as R⁻³ᐟ². N16 makes this a coarse scale-space diagnostic, not a precision exponent claim.</small>`;
  }

  private drawPower(frame: VolumeFrame, center: Vec3) {
    const axis = this.packet!.manifest.registered_geometry.axis_u;
    const profile = responsePowerProfile(frame, center, axis);
    const ctx = clear(this.powerCanvas);
    const box = { x: 62, y: 22, w: 595, h: 245 };
    axes(ctx, box, "log r", "p_eff");
    const clean = profile.pEff.map((v) => Number.isFinite(v) && Math.abs(v) < 8 ? v : Number.NaN);
    plotLine(ctx, profile.radii, clean, box, "#78b8ff", -3, 6, true);
    const y2 = box.y + box.h - (2 - (-3)) / 9 * box.h;
    ctx.strokeStyle = "rgba(242,199,107,.65)";
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(box.x, y2); ctx.lineTo(box.x + box.w, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f2c76b";
    ctx.fillText("inverse-square reference p=2", 360, y2 - 7);
    const far = clean.filter(Number.isFinite).slice(-10);
    const p = far.length ? far.reduce((a, b) => a + b, 0) / far.length : Number.NaN;
    required(this.root, "#scale-power-readout").innerHTML =
      `closure=${this.closure} · centre=registered periodic image · usable r≤${profile.rMax.toFixed(2)} · outer p<sub>eff</sub>≈${p.toFixed(3)}<br>` +
      `<small>Near zero crossings p_eff is undefined. This panel measures the action-readout channel only; V14K0 already showed it is not the total physical force.</small>`;
  }

  private drawModal(frame: VolumeFrame, center: Vec3) {
    const profile = shellAngularProfile(frame, center);
    const ctx = clear(this.modalCanvas);
    const box = { x: 62, y: 22, w: 595, h: 245 };
    axes(ctx, box, "log R", "normalized mode");
    plotLine(ctx, profile.radii, profile.p1, box, "#55d6b3", 0, 2.2, true);
    plotLine(ctx, profile.radii, profile.p2, box, "#f2c76b", 0, 2.2, true);
    ctx.fillStyle = "#55d6b3"; ctx.fillText("P1 shell mode", 75, 38);
    ctx.fillStyle = "#f2c76b"; ctx.fillText("P2 shell mode", 190, 38);

    const e1 = outerStableMean(profile.exponent1, 6, 8);
    const e2 = outerStableMean(profile.exponent2, 6, 8);
    const softness = nearestRootSoftness(frame, this.frameIndex, center);
    const softText = softness
      ? `nearest W1 root ${softness.root.regime} · κ_soft=${softness.soft.toExponential(3)}`
      : "no qualified W1 root near registered centre";
    required(this.root, "#scale-modal-readout").innerHTML =
      `outer d ln P1/d ln R≈${e1.toFixed(3)} · outer d ln P2/d ln R≈${e2.toFixed(3)} · ${softText}<br>` +
      `<small>Exponent≈0 means this normalized readout mode is approximately scale-persistent over the sampled shells. It is a measured persistence proxy, not yet the transfer-operator eigenvalue λ_l and not total-force evidence.</small>`;
    required(this.root, "#scale-frontier-readout").innerHTML =
      `current readout: κ_soft=${softness ? softness.soft.toExponential(3) : "n/a"} · modal exponents P1=${e1.toFixed(3)}, P2=${e2.toFixed(3)}.<br>` +
      `<small>Future decisive overlay must use R17 natural events and true total-force stiffness: κ_soft(time/scale), measured angular gain, daughter separation / parent emergent scale. No coincidence is assumed from this diagnostic readout.</small>`;
  }

  private drawFold() {
    const rows = r15FoldScaling();
    const near = rows.filter((r) => r.deltaQ < 0.03);
    const fitSep = fitPowerLaw(near.map((r) => r.deltaQ), near.map((r) => r.separation));
    const fitGap = fitPowerLaw(near.map((r) => r.deltaQ), near.map((r) => r.bGap));
    const ctx = clear(this.foldCanvas);
    const box = { x: 62, y: 22, w: 595, h: 245 };
    axes(ctx, box, "log(q−qcrit)", "log observable");
    plotLine(ctx, rows.map((r) => r.deltaQ), rows.map((r) => r.separation), box, "#55d6b3", undefined, undefined, true, true);
    plotLine(ctx, rows.map((r) => r.deltaQ), rows.map((r) => r.bGap), box, "#f08b6e", undefined, undefined, true, true);
    ctx.fillStyle = "#55d6b3"; ctx.fillText("branch separation", 75, 38);
    ctx.fillStyle = "#f08b6e"; ctx.fillText("B-gap", 210, 38);
    const q = Number(required<HTMLInputElement>(this.root, "#scale-r15-q").value);
    const ex = r15Extrema(q);
    const current = ex
      ? `q=${q.toFixed(3)} → extrema r=${ex[0].toFixed(3)}, ${ex[1].toFixed(3)} · Δr=${(ex[1] - ex[0]).toFixed(3)}`
      : `q=${q.toFixed(3)} ≤ qcrit → no disconnected inner-sector fold`;
    required(this.root, "#scale-fold-readout").innerHTML =
      `q<sub>crit</sub>=${R15_Q_CRIT.toFixed(9)}, r<sub>crit</sub>=${R15_R_CRIT.toFixed(6)} · Δr∝Δq<sup>${fitSep.exponent.toFixed(4)}</sup> (R²=${fitSep.r2.toFixed(6)}), ΔB∝Δq<sup>${fitGap.exponent.toFixed(4)}</sup> (R²=${fitGap.r2.toFixed(6)})<br>` +
      `<small>${current}. This is an inherited R15 critical reference, not natural-clump proof.</small>`;
  }

  private drawHierarchy() {
    const m = Number(required<HTMLInputElement>(this.root, "#scale-m").value);
    const b = Number(required<HTMLInputElement>(this.root, "#scale-b").value);
    const eta = Number(required<HTMLInputElement>(this.root, "#scale-eta").value);
    required<HTMLOutputElement>(this.root, "#scale-m-label").value = m.toFixed(1);
    required<HTMLOutputElement>(this.root, "#scale-b-label").value = b.toFixed(1);
    required<HTMLOutputElement>(this.root, "#scale-eta-label").value = eta.toFixed(2);
    const D = hierarchyDimension(m, b);
    const sigma = shellActionExponent(D, eta);
    const levels = Array.from({ length: 9 }, (_, k) => k);
    const count = levels.map((k) => m ** k);
    const footprint = levels.map((k) => b ** (-2 * k));
    const aggregate = levels.map((k) => count[k]! * footprint[k]! * b ** (eta * k));
    const ctx = clear(this.hierarchyCanvas);
    const box = { x: 62, y: 22, w: 595, h: 245 };
    axes(ctx, box, "hierarchy step k", "log10 relative factor");
    plotLine(ctx, levels, count.map(Math.log10), box, "#55d6b3");
    plotLine(ctx, levels, footprint.map(Math.log10), box, "#78b8ff");
    plotLine(ctx, levels, aggregate.map(Math.log10), box, "#f2c76b");
    ctx.fillStyle = "#55d6b3"; ctx.fillText("number", 75, 38);
    ctx.fillStyle = "#78b8ff"; ctx.fillText("single Ω ~ R⁻²", 150, 38);
    ctx.fillStyle = "#f2c76b"; ctx.fillText("aggregate / level", 280, 38);
    const meaning = Math.abs(sigma) < 0.03
      ? "≈ scale-balanced"
      : sigma > 0 ? "grows with scale" : "decays with scale";
    required(this.root, "#scale-hierarchy-readout").innerHTML =
      `D=ln(m)/ln(b)=${D.toFixed(3)} · sandbox σ=D−2+η=${sigma.toFixed(3)} → ${meaning}.<br>` +
      `<small>Do not infer η from the observed final gain and feed it back here. m, b and η must come from independent measurements before σ can become a prediction. The exact algebraic point is only: m^k and b^−2k become a power law after eliminating k.</small>`;
  }
}
