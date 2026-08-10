type RootKind = "converging" | "diverging" | "neutral";
type BoundaryMode = "finite" | "nearest";

type Root = { s: number; slope: number; kind: RootKind } | null;
type RootSet = { left: Root; center: Root; right: Root };
type EncodedFrame = {
  t: number;
  componentCount: number;
  finite: string;
  nearest: string;
  density: string;
  roots: { finite: RootSet; nearest: RootSet };
};
type Packet = {
  schema: "VOXELLAB_V14J_AXIAL_EQUILIBRIUM_ATLAS_COMPACT_V1";
  packetId: string;
  source: { repository: string; branch: string; head: string; fullTimelineSha256: string; sourceStateSha256: string; v14jZipSha256: string };
  grid: { n: number; L: number; dx: number; rho0: number };
  sampling: { s0: number; ds: number; count: number; sourceCount: number; stride: number; w1Scale: number; densityScale: number };
  frames: EncodedFrame[];
  status: Record<string, string>;
  semantics: Record<string, string>;
};

type DecodedFrame = EncodedFrame & { s: number[]; w1: Record<BoundaryMode, number[]>; rho: number[] };

const DEFAULT_PACKET = "packets/R14_V14J_ACTION_EQUILIBRIUM_ATLAS_BROWSER_PACKET_V1.json";
const ROOT_COLOURS: Record<RootKind, string> = { converging: "#65d49c", diverging: "#ffad62", neutral: "#c8ced8" };

function decode16(text: string, scale: number, signed: boolean): number[] {
  const raw = atob(text);
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 2) out.push((signed ? view.getInt16(i, true) : view.getUint16(i, true)) * scale);
  return out;
}

function parsePacket(value: unknown): Packet {
  if (!value || typeof value !== "object") throw new Error("Equilibrium packet must be an object");
  const packet = value as Packet;
  if (packet.schema !== "VOXELLAB_V14J_AXIAL_EQUILIBRIUM_ATLAS_COMPACT_V1") throw new Error(`Unsupported schema: ${String(packet.schema)}`);
  if (!Array.isArray(packet.frames) || packet.frames.length < 2) throw new Error("Packet has no animation frames");
  if (!(packet.sampling.count > 2 && packet.sampling.ds > 0 && packet.sampling.w1Scale > 0)) throw new Error("Invalid sampling contract");
  return packet;
}

function decodeFrame(packet: Packet, frame: EncodedFrame): DecodedFrame {
  const s = Array.from({ length: packet.sampling.count }, (_, i) => packet.sampling.s0 + i * packet.sampling.ds);
  const finite = decode16(frame.finite, packet.sampling.w1Scale, true);
  const nearest = decode16(frame.nearest, packet.sampling.w1Scale, true);
  const rho = decode16(frame.density, packet.sampling.densityScale, false);
  if ([finite, nearest, rho].some(values => values.length !== s.length)) throw new Error("Decoded profile length mismatch");
  return { ...frame, s, w1: { finite, nearest }, rho };
}

function axisLandscape(s: number[], force: number[]): number[] {
  const u = [0];
  for (let i = 1; i < s.length; i += 1) u.push(u[i - 1]! - 0.5 * (force[i - 1]! + force[i]!) * (s[i]! - s[i - 1]!));
  const mean = u.reduce((a, b) => a + b, 0) / u.length;
  return u.map(value => value - mean);
}

export function classifySymmetricJacobian2D(jxx: number, jxy: number, jyx: number, jyy: number, tolerance = 1e-8): RootKind | "saddle" {
  const off = 0.5 * (jxy + jyx);
  const trace = jxx + jyy;
  const disc = Math.sqrt(Math.max(0, (jxx - jyy) ** 2 + 4 * off ** 2));
  const a = 0.5 * (trace - disc);
  const b = 0.5 * (trace + disc);
  if (Math.abs(a) <= tolerance || Math.abs(b) <= tolerance) return "neutral";
  if (a < 0 && b < 0) return "converging";
  if (a > 0 && b > 0) return "diverging";
  return "saddle";
}

function rootLabel(kind: RootKind): string {
  if (kind === "converging") return "AXIAL WELL CANDIDATE";
  if (kind === "diverging") return "AXIAL CREST / 3D SADDLE CANDIDATE";
  return "NEUTRAL / DEGENERATE";
}

function fmt(value: number, digits = 3): string { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }
function esc(value: string): string { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

function prep(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ratio = Math.min(2, Math.max(1, devicePixelRatio || 1));
  const width = Math.max(320, canvas.clientWidth || 900);
  const height = Number(canvas.dataset.height || 300);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("2D canvas unavailable");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
  return ctx;
}

function path(ctx: CanvasRenderingContext2D, xs: number[], ys: number[], X: (v: number) => number, Y: (v: number) => number): void {
  ctx.beginPath(); xs.forEach((v, i) => i ? ctx.lineTo(X(v), Y(ys[i]!)) : ctx.moveTo(X(v), Y(ys[i]!))); ctx.stroke();
}

export class EquilibriumMapPanel {
  private packet: Packet | null = null;
  private frames: DecodedFrame[] = [];
  private index = 0;
  private boundary: BoundaryMode = "finite";
  private playing = true;
  private density = true;
  private landscape = true;
  private compare = true;
  private labels = false;
  private last = 0;

  constructor(private readonly root: HTMLElement) {
    this.render(); this.bind();
    addEventListener("resize", () => this.paint());
    void this.loadDefault();
    requestAnimationFrame(this.animate);
  }

  private render(): void {
    this.root.innerHTML = `<style>
.eqmap{margin:28px auto;max-width:1420px;padding:18px;border:1px solid #29443f;border-radius:18px;background:#07100f;color:#e7f4f2;font:14px/1.45 Inter,system-ui,sans-serif}.eqmap h2{margin:0;font-size:24px}.eqmap .sub{color:#9db4b0;max-width:1050px}.eqmap .lock{margin:12px 0;padding:10px 12px;border-left:3px solid #ffad62;background:#121b19}.eqgrid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.55fr);gap:14px}.eqcard{border:1px solid #29443f;border-radius:14px;background:#0b1715;padding:12px}.eqcanvas{display:block;width:100%;height:auto;background:#07100f;border-radius:10px}.eqcontrols{display:grid;grid-template-columns:1fr 1fr;gap:8px}.eqcontrols button,.eqcontrols select,.eqcontrols input[type=file]{width:100%;border:1px solid #355b54;border-radius:9px;background:#10211e;color:#e7f4f2;padding:8px}.eqcontrols .wide{grid-column:1/-1}.eqchecks{display:grid;gap:7px;margin:10px 0;color:#b9ceca}.eqread{display:grid;grid-template-columns:1fr auto;gap:6px;font-variant-numeric:tabular-nums}.eqread span{color:#9db4b0}.eqroots{width:100%;border-collapse:collapse;margin-top:10px}.eqroots td,.eqroots th{padding:6px;border-bottom:1px solid #203d37;text-align:right}.eqroots td:first-child,.eqroots th:first-child{text-align:left}.eqlegend{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0;color:#afc4c0}.eqlegend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.eqstatus{font-weight:700;color:#ffad62}.eqfoot{color:#93aaa6;font-size:12px}.eqtwo{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}@media(max-width:900px){.eqgrid,.eqtwo{grid-template-columns:1fr}}
</style><section class="eqmap" data-testid="action-equilibrium-map-panel"><h2>A5 · Animated action-equilibrium atlas</h2><p class="sub">Frozen V14J axial action readout. It shows where the sampled action field converges, diverges or becomes degenerate before density support splits. The browser never recomputes source dynamics.</p><div class="lock"><span class="eqstatus" id="eq-status">LOADING</span><br>Converging roots are <b>axial well candidates</b>; a diverging axial root is only a <b>3D saddle candidate</b> until transverse Jacobian channels exist. W1 is not yet established as physical source force.</div><div class="eqgrid"><div class="eqcard"><canvas class="eqcanvas" id="eq-main" data-height="390" data-testid="equilibrium-map"></canvas><div class="eqlegend"><span><i style="background:#65d49c"></i>converging</span><span><i style="background:#ffad62"></i>diverging / saddle candidate</span><span><i style="background:#c8ced8"></i>neutral</span><span>solid: selected closure · dashed: comparison</span></div></div><aside class="eqcard"><div class="eqcontrols"><button id="eq-play">Pause</button><button id="eq-step">Step</button><button id="eq-reset">Reset</button><select id="eq-boundary"><option value="finite">finite frozen box</option><option value="nearest">nearest-periodic</option></select><input class="wide" id="eq-time" type="range" min="0" max="0" value="0"><label>Speed <input id="eq-speed" type="range" min="0.5" max="4" value="1" step="0.5"></label><input id="eq-file" type="file" accept="application/json,.json"></div><div class="eqchecks"><label><input id="eq-density" type="checkbox" checked> density overlay</label><label><input id="eq-landscape" type="checkbox" checked> axis line-integral display</label><label><input id="eq-compare" type="checkbox" checked> compare far closure</label><label><input id="eq-labels" type="checkbox"> reveal late component labels</label></div><div class="eqread" id="eq-readout"></div><table class="eqroots"><thead><tr><th>class</th><th>s</th><th>slope</th></tr></thead><tbody id="eq-roots"></tbody></table></aside></div><div class="eqtwo"><div class="eqcard"><canvas class="eqcanvas" id="eq-land" data-height="260"></canvas></div><div class="eqcard"><canvas class="eqcanvas" id="eq-atlas" data-height="260"></canvas></div></div><p class="eqfoot" id="eq-provenance"></p></section>`;
  }

  private el<T extends HTMLElement>(id: string): T { const node = this.root.querySelector<T>(`#${id}`); if (!node) throw new Error(`Missing #${id}`); return node; }
  private bind(): void {
    this.el<HTMLButtonElement>("eq-play").onclick = () => { this.playing = !this.playing; this.sync(); };
    this.el<HTMLButtonElement>("eq-step").onclick = () => { this.index = (this.index + 1) % Math.max(1, this.frames.length); this.sync(); };
    this.el<HTMLButtonElement>("eq-reset").onclick = () => { this.index = 0; this.playing = false; this.sync(); };
    this.el<HTMLSelectElement>("eq-boundary").onchange = e => { this.boundary = (e.currentTarget as HTMLSelectElement).value as BoundaryMode; this.sync(); };
    this.el<HTMLInputElement>("eq-time").oninput = e => { this.index = Number((e.currentTarget as HTMLInputElement).value); this.sync(); };
    this.el<HTMLInputElement>("eq-density").onchange = e => { this.density = (e.currentTarget as HTMLInputElement).checked; this.sync(); };
    this.el<HTMLInputElement>("eq-landscape").onchange = e => { this.landscape = (e.currentTarget as HTMLInputElement).checked; this.sync(); };
    this.el<HTMLInputElement>("eq-compare").onchange = e => { this.compare = (e.currentTarget as HTMLInputElement).checked; this.sync(); };
    this.el<HTMLInputElement>("eq-labels").onchange = e => { this.labels = (e.currentTarget as HTMLInputElement).checked; this.sync(); };
    this.el<HTMLInputElement>("eq-file").onchange = e => { const file = (e.currentTarget as HTMLInputElement).files?.[0]; if (file) void file.text().then(text => this.install(JSON.parse(text))); };
  }

  private async loadDefault(): Promise<void> {
    try { const response = await fetch(`${import.meta.env.BASE_URL}${DEFAULT_PACKET}`); if (!response.ok) throw new Error(`HTTP ${response.status}`); this.install(await response.json()); }
    catch (error) { this.el("eq-status").textContent = `LOAD FAILED · ${error instanceof Error ? error.message : String(error)}`; }
  }

  private install(value: unknown): void {
    this.packet = parsePacket(value); this.frames = this.packet.frames.map(frame => decodeFrame(this.packet!, frame)); this.index = 0;
    const slider = this.el<HTMLInputElement>("eq-time"); slider.max = String(this.frames.length - 1);
    this.el("eq-status").textContent = "TWO-WELL TOPOLOGY = ROBUST DIAGNOSTIC · W1 = NOT YET PHYSICAL FORCE";
    this.el("eq-provenance").textContent = `${this.packet.source.repository} · ${this.packet.source.branch} · ${this.packet.source.head} · compact stride ${this.packet.sampling.stride}/${this.packet.sampling.sourceCount}; exact roots retained, curves downsampled for browser display.`;
    this.sync();
  }

  private readonly animate = (now: number): void => {
    const speed = Number(this.el<HTMLInputElement>("eq-speed").value || 1);
    if (this.playing && this.frames.length && now - this.last > 700 / speed) { this.last = now; this.index = (this.index + 1) % this.frames.length; this.sync(); }
    requestAnimationFrame(this.animate);
  };

  private sync(): void {
    if (!this.frames.length || !this.packet) return;
    this.el<HTMLInputElement>("eq-time").value = String(this.index);
    this.el<HTMLButtonElement>("eq-play").textContent = this.playing ? "Pause" : "Play";
    const frame = this.frames[this.index]!; const roots = frame.roots[this.boundary];
    const list = [roots.left, roots.center, roots.right].filter((root): root is NonNullable<Root> => root !== null);
    this.el("eq-roots").innerHTML = list.map(root => `<tr><td style="color:${ROOT_COLOURS[root.kind]}">${esc(rootLabel(root.kind))}</td><td>${fmt(root.s)}</td><td>${fmt(root.slope)}</td></tr>`).join("");
    const component = this.labels ? String(frame.componentCount) : "hidden (late readout)";
    this.el("eq-readout").innerHTML = `<span>t</span><b>${fmt(frame.t, 1)}</b><span>closure</span><b>${esc(this.boundary)}</b><span>roots</span><b>${list.length}</b><span>density components</span><b>${component}</b><span>grid</span><b>N${this.packet.grid.n}/L${this.packet.grid.L}</b>`;
    this.paint();
  }

  private paint(): void { if (!this.frames.length) return; this.paintMain(); this.paintLandscape(); this.paintAtlas(); }

  private paintMain(): void {
    const frame = this.frames[this.index]!; const canvas = this.el<HTMLCanvasElement>("eq-main"); const ctx = prep(canvas); const w = canvas.clientWidth || 900; const h = Number(canvas.dataset.height); const pad = { l: 52, r: 22, t: 28, b: 42 };
    const xs = frame.s, ys = frame.w1[this.boundary], other = frame.w1[this.boundary === "finite" ? "nearest" : "finite"];
    const ymin = Math.min(0, ...ys, ...(this.compare ? other : [])), ymax = Math.max(0, ...ys, ...(this.compare ? other : [])); const span = Math.max(1e-9, ymax - ymin);
    const X = (v: number) => pad.l + (v - xs[0]!) / (xs.at(-1)! - xs[0]!) * (w - pad.l - pad.r); const Y = (v: number) => pad.t + (ymax - v) / span * (h - pad.t - pad.b);
    ctx.fillStyle = "#07100f"; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = "#25453f"; ctx.strokeRect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); ctx.strokeStyle = "#55716c"; ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(w - pad.r, Y(0)); ctx.stroke();
    if (this.compare) { ctx.setLineDash([6, 5]); ctx.strokeStyle = "#75918c"; path(ctx, xs, other, X, Y); ctx.setLineDash([]); }
    ctx.strokeStyle = "#70c7ba"; ctx.lineWidth = 2; path(ctx, xs, ys, X, Y);
    const step = 4; ctx.fillStyle = "#a7c9c3"; for (let i = 0; i < xs.length; i += step) { const sign = Math.sign(ys[i]!); if (!sign) continue; const x = X(xs[i]!); const y = Y(0) + 18; ctx.beginPath(); ctx.moveTo(x + sign * 7, y); ctx.lineTo(x - sign * 5, y - 4); ctx.lineTo(x - sign * 5, y + 4); ctx.closePath(); ctx.fill(); }
    const roots = frame.roots[this.boundary]; [roots.left, roots.center, roots.right].forEach(root => { if (!root) return; const x = X(root.s), y = Y(0); ctx.fillStyle = ROOT_COLOURS[root.kind]; ctx.beginPath(); root.kind === "diverging" ? (ctx.moveTo(x, y - 9), ctx.lineTo(x + 8, y + 7), ctx.lineTo(x - 8, y + 7), ctx.closePath()) : ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); });
    if (this.density) { const dmin = Math.min(...frame.rho), dmax = Math.max(...frame.rho); const DY = (v: number) => h - pad.b - 70 * (v - dmin) / Math.max(1e-9, dmax - dmin); ctx.strokeStyle = "rgba(214,225,230,.5)"; ctx.lineWidth = 1; path(ctx, xs, frame.rho, X, DY); }
    ctx.fillStyle = "#dcebe8"; ctx.font = "600 13px system-ui"; ctx.fillText(`ΔW1∥ · t=${fmt(frame.t, 1)} · ${this.boundary}`, pad.l, 18); ctx.fillStyle = "#92aaa5"; ctx.font = "11px system-ui"; ctx.fillText("s along preregistered future inter-centre axis", w - 285, h - 12);
  }

  private paintLandscape(): void {
    const frame = this.frames[this.index]!; const canvas = this.el<HTMLCanvasElement>("eq-land"); const ctx = prep(canvas); const w = canvas.clientWidth || 600; const h = Number(canvas.dataset.height); ctx.fillStyle = "#07100f"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#dcebe8"; ctx.font = "600 13px system-ui"; ctx.fillText("−∫axis ΔW1∥ ds · display only · NOT physical potential", 16, 20);
    if (!this.landscape) { ctx.fillStyle = "#92aaa5"; ctx.fillText("overlay disabled", 16, 48); return; }
    const u = axisLandscape(frame.s, frame.w1[this.boundary]); const xmin = frame.s[0]!, xmax = frame.s.at(-1)!, ymin = Math.min(...u), ymax = Math.max(...u); const X = (v: number) => 42 + (v - xmin) / (xmax - xmin) * (w - 60); const Y = (v: number) => 35 + (ymax - v) / Math.max(1e-9, ymax - ymin) * (h - 65); ctx.strokeStyle = "#8fc8be"; ctx.lineWidth = 2; path(ctx, frame.s, u, X, Y);
    const roots = frame.roots[this.boundary]; [roots.left, roots.center, roots.right].forEach(root => { if (!root) return; ctx.fillStyle = ROOT_COLOURS[root.kind]; ctx.beginPath(); ctx.arc(X(root.s), Y(axisLandscape(frame.s, frame.w1[this.boundary])[Math.max(0, Math.min(frame.s.length - 1, Math.round((root.s - xmin) / this.packet!.sampling.ds)))]!), 5, 0, Math.PI * 2); ctx.fill(); });
  }

  private paintAtlas(): void {
    const canvas = this.el<HTMLCanvasElement>("eq-atlas"); const ctx = prep(canvas); const w = canvas.clientWidth || 600; const h = Number(canvas.dataset.height); ctx.fillStyle = "#07100f"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#dcebe8"; ctx.font = "600 13px system-ui"; ctx.fillText("Branch atlas · topology persists through 1→2→1 density labels", 16, 20);
    const t0 = this.frames[0]!.t, t1 = this.frames.at(-1)!.t, s0 = this.frames[0]!.s[0]!, s1 = this.frames[0]!.s.at(-1)!; const X = (t: number) => 42 + (t - t0) / (t1 - t0) * (w - 62); const Y = (s: number) => 34 + (s1 - s) / (s1 - s0) * (h - 60);
    if (this.labels) this.frames.forEach((frame, i) => { if (frame.componentCount === 2) { const next = this.frames[i + 1]?.t ?? frame.t + 1; ctx.fillStyle = "rgba(255,173,98,.09)"; ctx.fillRect(X(frame.t), 34, Math.max(2, X(next) - X(frame.t)), h - 60); } });
    for (const key of ["left", "center", "right"] as const) { const points = this.frames.map(frame => ({ t: frame.t, root: frame.roots[this.boundary][key] })).filter((p): p is { t: number; root: NonNullable<Root> } => p.root !== null); if (!points.length) continue; ctx.strokeStyle = ROOT_COLOURS[points[0]!.root.kind]; ctx.lineWidth = 2; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.root.s)) : ctx.moveTo(X(p.t), Y(p.root.s))); ctx.stroke(); }
    const current = this.frames[this.index]!; ctx.strokeStyle = "#ffffff"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(current.t), 34); ctx.lineTo(X(current.t), h - 26); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#92aaa5"; ctx.font = "11px system-ui"; ctx.fillText("time", w - 50, h - 8); ctx.save(); ctx.translate(12, 120); ctx.rotate(-Math.PI / 2); ctx.fillText("root position s", 0, 0); ctx.restore();
  }
}
