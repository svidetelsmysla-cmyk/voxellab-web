import { frameVolume, loadEquilibriumPacket } from "./equilibriumGpu/packetLoader";
import { sampleResponse } from "./equilibriumGpu/cpuReference";
import type { ClosureMode, LoadedEquilibriumPacket, Vec3, VolumeFrame } from "./equilibriumGpu/types";
import {
  fitPowerLaw,
  hierarchyDimension,
  localPowerExponent,
  R15_Q_CRIT,
  R15_R_CRIT,
  r15B,
  r15Extrema,
  r15FoldScaling,
  shellActionExponent,
} from "./scalingAnalysis";

const PACKET_URL = `${import.meta.env.BASE_URL}packets/webgpu-equilibrium-regime-map-v1`;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const n = Math.max(norm(a), 1e-30); return [a[0] / n, a[1] / n, a[2] / n]; };
const addScaled = (p: Vec3, a: Vec3, s: number): Vec3 => [p[0] + a[0] * s, p[1] + a[1] * s, p[2] + a[2] * s];

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing scale-law element ${selector}`);
  return value;
}

function clear(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#071018"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function axes(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, xLabel: string, yLabel: string) {
  ctx.strokeStyle = "rgba(210,230,240,.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(box.x, box.y); ctx.lineTo(box.x, box.y + box.h); ctx.lineTo(box.x + box.w, box.y + box.h); ctx.stroke();
  ctx.fillStyle = "rgba(220,235,244,.72)"; ctx.font = "12px system-ui";
  ctx.fillText(xLabel, box.x + box.w - 80, box.y + box.h + 25);
  ctx.save(); ctx.translate(box.x - 42, box.y + 70); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore();
}

function plotLine(ctx: CanvasRenderingContext2D, xs: readonly number[], ys: readonly number[], box: { x: number; y: number; w: number; h: number }, color: string, yMin?: number, yMax?: number, logX = false, logY = false) {
  const pairs = xs.map((x, i) => [x, ys[i]!] as const).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!logX || x > 0) && (!logY || y > 0));
  if (pairs.length < 2) return;
  const tx = pairs.map(([x]) => logX ? Math.log10(x) : x);
  const ty = pairs.map(([, y]) => logY ? Math.log10(y) : y);
  const xmin = Math.min(...tx), xmax = Math.max(...tx);
  const ymin = yMin ?? Math.min(...ty), ymax = yMax ?? Math.max(...ty);
  const X = (x: number) => box.x + (x - xmin) / Math.max(xmax - xmin, 1e-30) * box.w;
  const Y = (y: number) => box.y + box.h - (y - ymin) / Math.max(ymax - ymin, 1e-30) * box.h;
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  pairs.forEach(([x, y], i) => { const xx = X(logX ? Math.log10(x) : x), yy = Y(logY ? Math.log10(y) : y); if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); });
  ctx.stroke();
}

interface UniformityProfile { radii: number[]; meanDelta: number[]; rmsDelta: number[]; cumulativeAmount: number[]; dEff: number[]; hEff: number[]; globalMean: number; }

function gridPoint(frame: VolumeFrame, x: number, y: number, z: number): Vec3 {
  return [frame.origin[0] + x * frame.spacing[0], frame.origin[1] + y * frame.spacing[1], frame.origin[2] + z * frame.spacing[2]];
}

function uniformityProfile(frame: VolumeFrame, center: Vec3): UniformityProfile {
  const rho = frame.rho!; const [nx, ny, nz] = frame.dimensions;
  const globalMean = rho.reduce((a, b) => a + b, 0) / rho.length;
  const nodes: Array<{ r: number; rho: number }> = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const p = gridPoint(frame, x, y, z); const rr = Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]);
    nodes.push({ r: rr, rho: rho[(z * ny + y) * nx + x]! });
  }
  nodes.sort((a, b) => a.r - b.r);
  const rMin = Math.max(frame.spacing[0], frame.spacing[1], frame.spacing[2]);
  const rMax = nodes[Math.floor(nodes.length * 0.82)]?.r ?? nodes.at(-1)!.r;
  const radii = Array.from({ length: 34 }, (_, i) => rMin * (rMax / rMin) ** (i / 33));
  const meanDelta: number[] = [], rmsDelta: number[] = [], cumulativeAmount: number[] = [];
  const dV = frame.spacing[0] * frame.spacing[1] * frame.spacing[2];
  for (const R of radii) {
    const inside = nodes.filter((n) => n.r <= R);
    if (!inside.length) { meanDelta.push(Number.NaN); rmsDelta.push(Number.NaN); cumulativeAmount.push(Number.NaN); continue; }
    const sum = inside.reduce((a, n) => a + n.rho, 0);
    meanDelta.push(Math.abs(sum / inside.length - globalMean));
    rmsDelta.push(Math.sqrt(inside.reduce((a, n) => a + (n.rho - globalMean) ** 2, 0) / inside.length));
    cumulativeAmount.push(sum * dV);
  }
  return { radii, meanDelta, rmsDelta, cumulativeAmount, dEff: localPowerExponent(radii, cumulativeAmount).map((v) => -v), hEff: localPowerExponent(radii, meanDelta), globalMean };
}

function rayLimit(frame: VolumeFrame, center: Vec3, axis: Vec3, sign: number) {
  let limit = Infinity;
  for (let k = 0; k < 3; k++) {
    const a = axis[k]! * sign; if (Math.abs(a) < 1e-12) continue;
    const low = frame.origin[k]!; const high = low + (frame.dimensions[k]! - 1) * frame.spacing[k]!;
    const t = a > 0 ? (high - center[k]!) / a : (low - center[k]!) / a;
    if (t > 0) limit = Math.min(limit, t);
  }
  return limit;
}

function responsePowerProfile(frame: VolumeFrame, center: Vec3, axis0: Vec3) {
  const axis = unit(axis0);
  const rMax = 0.84 * Math.min(rayLimit(frame, center, axis, +1), rayLimit(frame, center, axis, -1));
  const rMin = Math.max(0.8 * Math.min(...frame.spacing), 0.5);
  const radii = Array.from({ length: 72 }, (_, i) => rMin * (rMax / rMin) ** (i / 71));
  const amplitude = radii.map((r) => {
    const plus = sampleResponse(frame, addScaled(center, axis, r));
    const minus = sampleResponse(frame, addScaled(center, axis, -r));
    return 0.5 * (Math.abs(dot(plus, axis)) + Math.abs(dot(minus, axis)));
  });
  return { radii, amplitude, pEff: localPowerExponent(radii, amplitude), rMax };
}

export class ScalingAnalysisPanel {
  private packet?: LoadedEquilibriumPacket;
  private frameIndex = 35;
  private closure: ClosureMode = "NEAREST_PERIODIC";
  private readonly uniformityCanvas: HTMLCanvasElement;
  private readonly powerCanvas: HTMLCanvasElement;
  private readonly foldCanvas: HTMLCanvasElement;
  private readonly hierarchyCanvas: HTMLCanvasElement;
  private readonly status: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <section class="scale-law-card" id="action-lab-scale-law-explorer-v1">
        <header class="scale-law-header">
          <div><p class="scale-law-kicker">R6 ANALYTIC MODE · V14H/V14J + R15 HOLDOUT</p><h2>Scale Law Explorer</h2>
          <p>What survives when we zoom out? Where is 1/r² real? Where does a finite scale appear?</p></div>
          <span class="scale-law-ceiling">DIAGNOSTIC / PROJECT HYPOTHESIS · NO NEW FORCE LAW</span>
        </header>
        <div class="scale-law-firewall"><b>Read correctly:</b> V14H response is an ACTION READOUT, not total physical source force. R15 fold is an inherited candidate reference. The hierarchy panel is a mathematical hypothesis sandbox.</div>
        <div class="scale-law-controls">
          <label>V14H frame <input id="scale-frame" type="range" min="0" max="35" step="1" value="35"><output id="scale-frame-label">t=70</output></label>
          <label>Closure <select id="scale-closure"><option value="FINITE_BOX">finite box</option><option value="NEAREST_PERIODIC" selected>nearest periodic</option></select></label>
          <label>R15 q <input id="scale-r15-q" type="range" min="2.0" max="3.5" step="0.005" value="2.35"><output id="scale-r15-q-label">2.350</output></label>
        </div>
        <div class="scale-law-grid">
          <article><h3>1 · Containing-volume uniformity</h3><p>Nested 3D windows around the registered branch centre. D<sub>eff</sub>=d ln N/d ln R; homogeneous 3D amount tends toward 3.</p><canvas id="scale-uniformity" width="690" height="330"></canvas><div id="scale-uniformity-readout" class="scale-readout"></div></article>
          <article><h3>2 · Local power exponent</h3><p>p<sub>eff</sub>(r)=−d ln|R|/d ln r along the frozen branch axis. A far inverse-square channel would approach p=2.</p><canvas id="scale-power" width="690" height="330"></canvas><div id="scale-power-readout" class="scale-readout"></div></article>
          <article><h3>3 · R15 critical fold</h3><p>Internal characteristic geometry: q crosses q<sub>crit</sub>. Log-log scaling tests whether branch birth has a universal local exponent.</p><canvas id="scale-fold" width="690" height="330"></canvas><div id="scale-fold-readout" class="scale-readout"></div></article>
          <article class="scale-hierarchy"><h3>4 · Inter-level balance sandbox</h3><p>Two geometric/exponential trends per hierarchy step: number grows, individual solid-angle footprint falls. Eliminate the hidden level index and a power law appears.</p>
            <div class="scale-mini-controls"><label>count ratio m <input id="scale-m" type="range" min="1.1" max="16" step="0.1" value="4"><output id="scale-m-label">4.0</output></label><label>length ratio b <input id="scale-b" type="range" min="1.1" max="6" step="0.1" value="2"><output id="scale-b-label">2.0</output></label><label>quality exponent η <input id="scale-eta" type="range" min="-2" max="2" step="0.05" value="0"><output id="scale-eta-label">0.00</output></label></div>
            <canvas id="scale-hierarchy" width="690" height="330"></canvas><div id="scale-hierarchy-readout" class="scale-readout"></div>
          </article>
        </div>
        <div class="scale-law-thesis"><b>Structural-resonance test:</b> after coarse-graining and rescaling, do normalized matter shape, angular-action moments and equilibrium topology collapse onto the same dimensionless pattern? If yes, that is evidence for an inter-level fixed point; if no, “similarity of levels” is only an analogy.</div>
        <div id="scale-law-status" class="scale-law-status">loading governed packet…</div>
      </section>`;
    this.uniformityCanvas = required(root, "#scale-uniformity");
    this.powerCanvas = required(root, "#scale-power");
    this.foldCanvas = required(root, "#scale-fold");
    this.hierarchyCanvas = required(root, "#scale-hierarchy");
    this.status = required(root, "#scale-law-status");
    this.bind();
    this.drawFold(); this.drawHierarchy();
    void this.initialize();
  }

  private bind() {
    required<HTMLInputElement>(this.root, "#scale-frame").addEventListener("input", (event) => { this.frameIndex = Number((event.currentTarget as HTMLInputElement).value); this.renderSourcePanels(); });
    required<HTMLSelectElement>(this.root, "#scale-closure").addEventListener("change", (event) => { this.closure = (event.currentTarget as HTMLSelectElement).value as ClosureMode; this.renderSourcePanels(); });
    required<HTMLInputElement>(this.root, "#scale-r15-q").addEventListener("input", (event) => { required<HTMLOutputElement>(this.root, "#scale-r15-q-label").value = Number((event.currentTarget as HTMLInputElement).value).toFixed(3); this.drawFold(); });
    for (const id of ["#scale-m", "#scale-b", "#scale-eta"]) required<HTMLInputElement>(this.root, id).addEventListener("input", () => this.drawHierarchy());
  }

  private async initialize() {
    try {
      this.packet = await loadEquilibriumPacket(PACKET_URL);
      this.status.innerHTML = `<b>PACKET VERIFIED</b> · ${this.packet.manifest.packet_id} · source ${this.packet.manifest.grid.dimensions.join("×")} · ${this.packet.manifest.source.claim_ceiling}`;
      this.renderSourcePanels();
    } catch (error) { this.status.textContent = error instanceof Error ? error.message : String(error); }
  }

  private renderSourcePanels() {
    if (!this.packet) return;
    const frame = frameVolume(this.packet, this.frameIndex, this.closure);
    required<HTMLOutputElement>(this.root, "#scale-frame-label").value = `t=${this.packet.manifest.times[this.frameIndex]!.toFixed(1)}`;
    this.drawUniformity(frame); this.drawPower(frame);
  }

  private drawUniformity(frame: VolumeFrame) {
    const profile = uniformityProfile(frame, [0, 0, 0]); const ctx = clear(this.uniformityCanvas); const box = { x: 62, y: 22, w: 595, h: 245 }; axes(ctx, box, "log R", "running exponent");
    plotLine(ctx, profile.radii, profile.dEff, box, "#55d6b3", 0, 5, true, false);
    plotLine(ctx, profile.radii, profile.hEff, box, "#f2c76b", 0, 8, true, false);
    ctx.strokeStyle = "rgba(120,190,255,.45)"; const y3 = box.y + box.h - 3 / 5 * box.h; ctx.beginPath(); ctx.moveTo(box.x, y3); ctx.lineTo(box.x + box.w, y3); ctx.stroke();
    ctx.fillStyle="#55d6b3";ctx.fillText("D_eff amount",75,38);ctx.fillStyle="#f2c76b";ctx.fillText("h_eff mean contrast",185,38);ctx.fillStyle="#88c5ff";ctx.fillText("3D homogeneous = 3",330,38);
    const validD = profile.dEff.filter(Number.isFinite); const lastD = validD.at(-1) ?? Number.NaN; const validH = profile.hEff.filter((v) => Number.isFinite(v) && Math.abs(v) < 30); const lastH = validH.at(-1) ?? Number.NaN;
    required(this.root,"#scale-uniformity-readout").innerHTML = `global ⟨ρ⟩=${profile.globalMean.toFixed(5)} · outer D<sub>eff</sub>≈${lastD.toFixed(3)} · outer h<sub>eff</sub>≈${lastH.toFixed(3)}<br><small>D_eff tests dimensional filling; h_eff tests how fast a local mean contrast is diluted. N16 limits fine claims.</small>`;
  }

  private drawPower(frame: VolumeFrame) {
    const axis = this.packet!.manifest.registered_geometry.axis_u; const profile = responsePowerProfile(frame,[0,0,0],axis); const ctx=clear(this.powerCanvas); const box={x:62,y:22,w:595,h:245}; axes(ctx,box,"log r","p_eff");
    const clean=profile.pEff.map((v)=>Number.isFinite(v)&&Math.abs(v)<8?v:Number.NaN); plotLine(ctx,profile.radii,clean,box,"#78b8ff",-3,6,true,false);
    const y2=box.y+box.h-(2-(-3))/(6-(-3))*box.h;ctx.strokeStyle="rgba(242,199,107,.65)";ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(box.x,y2);ctx.lineTo(box.x+box.w,y2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#f2c76b";ctx.fillText("inverse-square reference p=2",360,y2-7);
    const far = clean.filter(Number.isFinite).slice(-10); const p = far.length ? far.reduce((a,b)=>a+b,0)/far.length : Number.NaN;
    required(this.root,"#scale-power-readout").innerHTML=`closure=${this.closure} · usable symmetric axis r≤${profile.rMax.toFixed(2)} · outer p<sub>eff</sub>≈${p.toFixed(3)}<br><small>Do not interpret divergences near zero crossings as force exponents: p_eff is meaningful only inside a sign-stable nonzero channel.</small>`;
  }

  private drawFold() {
    const rows=r15FoldScaling(); const fitSep=fitPowerLaw(rows.filter(r=>r.deltaQ<0.03).map(r=>r.deltaQ),rows.filter(r=>r.deltaQ<0.03).map(r=>r.separation)); const fitGap=fitPowerLaw(rows.filter(r=>r.deltaQ<0.03).map(r=>r.deltaQ),rows.filter(r=>r.deltaQ<0.03).map(r=>r.bGap));
    const ctx=clear(this.foldCanvas);const box={x:62,y:22,w:595,h:245};axes(ctx,box,"log(q−qcrit)","log observable");plotLine(ctx,rows.map(r=>r.deltaQ),rows.map(r=>r.separation),box,"#55d6b3",undefined,undefined,true,true);plotLine(ctx,rows.map(r=>r.deltaQ),rows.map(r=>r.bGap),box,"#f08b6e",undefined,undefined,true,true);ctx.fillStyle="#55d6b3";ctx.fillText("branch separation",75,38);ctx.fillStyle="#f08b6e";ctx.fillText("B-gap",210,38);
    const q=Number(required<HTMLInputElement>(this.root,"#scale-r15-q").value);const ex=r15Extrema(q);const current=ex?`q=${q.toFixed(3)} → extrema r=${ex[0].toFixed(3)}, ${ex[1].toFixed(3)} · Δr=${(ex[1]-ex[0]).toFixed(3)}`:`q=${q.toFixed(3)} ≤ qcrit → no disconnected inner-sector fold`;
    required(this.root,"#scale-fold-readout").innerHTML=`q<sub>crit</sub>=${R15_Q_CRIT.toFixed(9)}, r<sub>crit</sub>=${R15_R_CRIT.toFixed(6)} · local fits: Δr∝Δq<sup>${fitSep.exponent.toFixed(4)}</sup> (R²=${fitSep.r2.toFixed(6)}), ΔB∝Δq<sup>${fitGap.exponent.toFixed(4)}</sup> (R²=${fitGap.r2.toFixed(6)})<br><small>${current}. This is a cross-lane method reference, not a natural-clump proof.</small>`;
  }

  private drawHierarchy() {
    const m=Number(required<HTMLInputElement>(this.root,"#scale-m").value), b=Number(required<HTMLInputElement>(this.root,"#scale-b").value), eta=Number(required<HTMLInputElement>(this.root,"#scale-eta").value);
    required<HTMLOutputElement>(this.root,"#scale-m-label").value=m.toFixed(1);required<HTMLOutputElement>(this.root,"#scale-b-label").value=b.toFixed(1);required<HTMLOutputElement>(this.root,"#scale-eta-label").value=eta.toFixed(2);
    const D=hierarchyDimension(m,b), sigma=shellActionExponent(D,eta);const levels=Array.from({length:9},(_,k)=>k);const count=levels.map(k=>m**k), footprint=levels.map(k=>b**(-2*k)), aggregate=levels.map(k=>count[k]!*footprint[k]!*b**(eta*k));
    const ctx=clear(this.hierarchyCanvas);const box={x:62,y:22,w:595,h:245};axes(ctx,box,"hierarchy step k","log10 relative factor");plotLine(ctx,levels,count.map(Math.log10),box,"#55d6b3");plotLine(ctx,levels,footprint.map(Math.log10),box,"#78b8ff");plotLine(ctx,levels,aggregate.map(Math.log10),box,"#f2c76b");ctx.fillStyle="#55d6b3";ctx.fillText("number",75,38);ctx.fillStyle="#78b8ff";ctx.fillText("single Ω ~ R⁻²",150,38);ctx.fillStyle="#f2c76b";ctx.fillText("aggregate / level",280,38);
    const meaning=Math.abs(sigma)<0.03?"≈ scale-balanced: each logarithmic level contributes comparably":sigma>0?"grows toward larger scales unless angular cancellation removes it":"decays toward larger scales; nearer levels dominate";
    required(this.root,"#scale-hierarchy-readout").innerHTML=`D=ln(m)/ln(b)=${D.toFixed(3)} · per-log-scale exponent σ=D−2+η=${sigma.toFixed(3)} → ${meaning}.<br><small>This is the exact “two exponentials → power law” mechanism in hierarchy coordinates: m<sup>k</sup> and b<sup>−2k</sup> become R<sup>D−2</sup> after eliminating k.</small>`;
  }
}
