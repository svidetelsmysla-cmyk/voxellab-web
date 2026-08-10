import {
  classifyAt,
  findQualifiedRoots,
  sampleDensity,
  samplePlaneCpu,
} from "./equilibriumGpu/cpuReference";
import { trackRootBranches } from "./equilibriumGpu/branchTracker";
import { hasWebGpu, samplePlaneWebGpu } from "./equilibriumGpu/gpuContext";
import { frameVolume, loadEquilibriumPacket } from "./equilibriumGpu/packetLoader";
import { comparePlaneResults, type PlaneParityReceipt } from "./equilibriumGpu/receipts";
import {
  DEFAULT_THRESHOLDS,
  type ClosureMode,
  type LoadedEquilibriumPacket,
  type PlaneDefinition,
  type PlaneResult,
  type QualifiedRoot,
  type RootBranch,
  type Vec3,
} from "./equilibriumGpu/types";

const PACKET_URL = `${import.meta.env.BASE_URL}packets/webgpu-equilibrium-regime-map-v1`;
const COLORS = [
  [45, 51, 60],
  [29, 176, 138],
  [239, 144, 68],
  [218, 92, 73],
  [139, 74, 207],
  [232, 215, 113],
] as const;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export class EquilibriumRegimeMapPanel {
  private packet?: LoadedEquilibriumPacket;
  private closure: ClosureMode = "FINITE_BOX";
  private frameIndex = 0;
  private receiverWidth = 257;
  private receiverHeight = 193;
  private densityOverlay = false;
  private neutralTolerance = DEFAULT_THRESHOLDS.neutralTolerance;
  private result?: PlaneResult;
  private roots: QualifiedRoot[] = [];
  private branches: RootBranch[] = [];
  private neutralThresholds: number[] = [];
  private lastParity?: PlaneParityReceipt;
  private lastAdapter?: { vendor: string; architecture: string; device: string; description: string };
  private lastGpuElapsedMs?: number;
  private renderGeneration = 0;
  private branchGeneration = 0;
  private readonly canvas: HTMLCanvasElement;
  private readonly timelineCanvas: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private readonly backendBadge: HTMLElement;
  private readonly parityBox: HTMLElement;
  private readonly rootBox: HTMLElement;
  private readonly frameLabel: HTMLElement;
  private readonly closureLabel: HTMLElement;
  private readonly resolutionBadge: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <section class="equilibrium-map-card" id="webgpu-equilibrium-regime-map-v1">
        <header class="eq-header">
          <div><p class="eq-kicker">V14H / V14J · governed diagnostic</p><h2>Equilibrium regime map</h2>
          <p class="eq-subtitle">Full 3D response → branch-aligned plane → K = −sym(∂R/∂x) → qualified 3D roots.</p></div>
          <div class="eq-badges"><span id="eq-backend">INITIALIZING</span><span>ACTION_READOUT_NOT_SOURCE_FORCE</span><button id="eq-export-receipt" type="button">Export numeric receipt</button></div>
        </header>
        <div class="eq-firewall"><strong>Scientific firewall:</strong> local response/stiffness diagnostic only. No source force, cadence, scale, validation, dipole or physical stability claim.</div>
        <div class="eq-controls">
          <label>Timeline <input id="eq-frame" type="range" min="0" max="35" value="0" step="1"><output id="eq-frame-label">frame 0</output></label>
          <label>Closure <select id="eq-closure"><option value="FINITE_BOX">finite box</option><option value="NEAREST_PERIODIC">nearest periodic</option></select></label>
          <label>Receiver grid <select id="eq-resolution"><option>129×97</option><option selected>257×193</option><option>513×385</option></select></label>
          <label>Neutral ε<sub>K</sub> <input id="eq-neutral" type="range" min="-10" max="-4" value="-7" step="0.25"><output id="eq-neutral-label">1.0e−7</output></label>
          <label class="eq-check"><input id="eq-density" type="checkbox"> density overlay (display only)</label>
        </div>
        <div class="eq-resolution-firewall"><span>source: <b>N16 (16³)</b></span><span id="eq-receiver-badge">receiver: 257×193</span><span>render: CSS pixels / DPR</span></div>
        <div class="eq-map-shell"><canvas id="eq-map" width="257" height="193" aria-label="Equilibrium regime map"></canvas>
          <div class="eq-legend"><span class="well">restoring signature</span><span class="saddle1">saddle index 1</span><span class="saddle2">saddle index 2</span><span class="peak">divergent</span><span class="neutral">neutral / degenerate</span><span class="unresolved">unresolved</span></div>
        </div>
        <div class="eq-readouts">
          <article><h3>3D-qualified roots</h3><div id="eq-roots">pending packet…</div></article>
          <article><h3>GPU ↔ CPU parity</h3><div id="eq-parity">pending adapter…</div></article>
          <article><h3>Provenance</h3><div id="eq-status">verifying immutable P1 packet…</div></article>
        </div>
        <section class="eq-timeline"><h3>Persistent root branches — density-independent tracking</h3><canvas id="eq-timeline" width="900" height="145"></canvas><p id="eq-closure-label">finite box timeline</p><button id="eq-recompute-branches" type="button">Recompute 3D timeline locally</button></section>
      </section>`;
    this.canvas = root.querySelector("#eq-map")!;
    this.timelineCanvas = root.querySelector("#eq-timeline")!;
    this.status = root.querySelector("#eq-status")!;
    this.backendBadge = root.querySelector("#eq-backend")!;
    this.parityBox = root.querySelector("#eq-parity")!;
    this.rootBox = root.querySelector("#eq-roots")!;
    this.frameLabel = root.querySelector("#eq-frame-label")!;
    this.closureLabel = root.querySelector("#eq-closure-label")!;
    this.resolutionBadge = root.querySelector("#eq-receiver-badge")!;
    root.dataset.userAgent = navigator.userAgent;
    this.bindControls();
    void this.initialize();
  }

  private bindControls() {
    const frame = this.root.querySelector<HTMLInputElement>("#eq-frame")!;
    frame.addEventListener("input", () => {
      this.frameIndex = Number(frame.value);
      this.applyFrozenNeutralThreshold();
      void this.renderSelectedFrame();
    });
    this.root.querySelector<HTMLSelectElement>("#eq-closure")!.addEventListener("change", (event) => {
      this.closure = (event.currentTarget as HTMLSelectElement).value as ClosureMode;
      this.closureLabel.textContent = `${this.closure === "FINITE_BOX" ? "finite box" : "nearest periodic"} timeline`;
      void (async () => { await this.loadPrecomputedBranches(); await this.renderSelectedFrame(); })();
    });
    this.root.querySelector<HTMLSelectElement>("#eq-resolution")!.addEventListener("change", (event) => {
      const [width, height] = (event.currentTarget as HTMLSelectElement).value.split("×").map(Number);
      this.receiverWidth = width!; this.receiverHeight = height!;
      this.resolutionBadge.textContent = `receiver: ${width}×${height}`;
      void this.renderSelectedFrame();
    });
    this.root.querySelector<HTMLInputElement>("#eq-neutral")!.addEventListener("input", (event) => {
      const exponent = Number((event.currentTarget as HTMLInputElement).value);
      this.neutralTolerance = 10 ** exponent;
      this.root.querySelector<HTMLOutputElement>("#eq-neutral-label")!.value = this.neutralTolerance.toExponential(1).replace("-", "−");
      void this.renderSelectedFrame();
    });
    this.root.querySelector<HTMLInputElement>("#eq-density")!.addEventListener("change", (event) => {
      this.densityOverlay = (event.currentTarget as HTMLInputElement).checked;
      this.drawMap();
    });
    this.root.querySelector<HTMLButtonElement>("#eq-recompute-branches")!.addEventListener("click", () => void this.buildBranches());
    this.root.querySelector<HTMLButtonElement>("#eq-export-receipt")!.addEventListener("click", () => this.exportReceipt());
  }

  private async initialize() {
    try {
      this.packet = await loadEquilibriumPacket(PACKET_URL);
      const manifest = this.packet.manifest;
      this.status.innerHTML = `<b>PACKET VERIFIED</b><br>${manifest.packet_id}<br>36 frames · two separate closures<br><code>${manifest.array_blobs.finite_response.sha256.slice(0, 16)}…</code>`;
      if (!hasWebGpu()) {
        this.receiverWidth = 129; this.receiverHeight = 97;
        this.root.querySelector<HTMLSelectElement>("#eq-resolution")!.value = "129×97";
        this.resolutionBadge.textContent = "receiver: 129×97 (CPU fallback)";
      }
      this.backendBadge.textContent = hasWebGpu() ? "WEBGPU ADAPTER DETECTED" : "CPU REFERENCE FALLBACK";
      // Let the verified provenance and firewalls become inspectable before the
      // intentionally slower CPU fallback evaluates the dense plane.
      await this.loadPrecomputedBranches();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await this.renderSelectedFrame();
    } catch (error) {
      this.backendBadge.textContent = "PACKET BLOCKER";
      this.status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  private async loadPrecomputedBranches() {
    try {
      const response = await fetch(`${PACKET_URL}/root_timeline.json`);
      if (!response.ok) throw new Error("root timeline missing");
      const receipt = await response.json() as { closures: Array<{ closure: ClosureMode; roots_by_frame: QualifiedRoot[][]; branches: RootBranch[]; neutral_thresholds: number[] }> };
      const selected = receipt.closures.find((item) => item.closure === this.closure);
      if (!selected) throw new Error("closure timeline missing");
      this.branches = selected.branches;
      this.neutralThresholds = selected.neutral_thresholds;
      this.applyFrozenNeutralThreshold();
      this.roots = selected.roots_by_frame[this.frameIndex] ?? [];
      this.drawTimeline(); this.updateReadouts(); this.drawMap();
    } catch {
      this.closureLabel.textContent += " · playback unavailable; manual recompute enabled";
    }
  }

  private applyFrozenNeutralThreshold() {
    const value = this.neutralThresholds[this.frameIndex];
    if (!value) return;
    this.neutralTolerance = value;
    const exponent = Math.log10(value);
    this.root.querySelector<HTMLInputElement>("#eq-neutral")!.value = String(Math.max(-10, Math.min(-4, exponent)));
    this.root.querySelector<HTMLOutputElement>("#eq-neutral-label")!.value = `${value.toExponential(2).replace("-", "−")} · prereg`;
  }

  private plane(): PlaneDefinition {
    const geometry = this.packet!.manifest.registered_geometry;
    return { origin: [0, 0, 0], axisU: geometry.axis_u, axisV: geometry.axis_v, extentU: 11.25, extentV: 11.25 };
  }

  private thresholds() {
    return { ...DEFAULT_THRESHOLDS, neutralTolerance: this.neutralTolerance };
  }

  private async renderSelectedFrame() {
    if (!this.packet) return;
    const generation = ++this.renderGeneration;
    const frame = frameVolume(this.packet, this.frameIndex, this.closure);
    const plane = this.plane();
    this.frameLabel.textContent = `frame ${this.frameIndex} · t=${this.packet.manifest.times[this.frameIndex]!.toFixed(1)}`;
    this.backendBadge.textContent = hasWebGpu() ? "WEBGPU COMPUTING" : "CPU REFERENCE FALLBACK";
    this.roots = findQualifiedRoots(frame, this.frameIndex, 2e-4, this.thresholds());
    let parity: PlaneParityReceipt | undefined;
    if (hasWebGpu()) {
      try {
        const gpu = await samplePlaneWebGpu(frame, plane, this.receiverWidth, this.receiverHeight, this.thresholds());
        if (generation !== this.renderGeneration) return;
        this.result = gpu.result;
        const parityCpu = samplePlaneCpu(frame, plane, 41, 33, this.thresholds());
        const parityGpu = await samplePlaneWebGpu(frame, plane, 41, 33, this.thresholds());
        parity = comparePlaneResults(parityCpu, parityGpu.result);
        this.lastAdapter = gpu.adapter;
        this.lastGpuElapsedMs = gpu.result.elapsedMs;
        this.backendBadge.dataset.adapter = JSON.stringify(gpu.adapter);
        this.backendBadge.dataset.elapsedMs = String(gpu.result.elapsedMs);
        this.backendBadge.textContent = `WEBGPU · ${gpu.adapter.description || gpu.adapter.vendor || "adapter"} · ${gpu.result.elapsedMs.toFixed(1)} ms`;
      } catch (error) {
        this.backendBadge.textContent = "CPU FALLBACK · GPU BLOCKED";
        this.parityBox.textContent = error instanceof Error ? error.message : String(error);
        this.result = samplePlaneCpu(frame, plane, Math.min(this.receiverWidth, 257), Math.min(this.receiverHeight, 193), this.thresholds());
      }
    } else {
      this.result = samplePlaneCpu(frame, plane, Math.min(this.receiverWidth, 257), Math.min(this.receiverHeight, 193), this.thresholds());
    }
    if (generation !== this.renderGeneration) return;
    this.updateReadouts(parity);
    this.drawMap();
  }

  private updateReadouts(parity?: PlaneParityReceipt) {
    if (parity) this.lastParity = parity;
    const persistent = new Set(this.branches.filter((b) => b.persistent).map((b) => b.id));
    this.rootBox.innerHTML = this.roots.length ? this.roots.map((root) =>
      `<div><b>${root.branchId ?? root.id}</b> · ${root.regime.replaceAll("_", " ")}<br><code>[${root.position.map((v) => v.toFixed(3)).join(", ")}]</code> · residual ${root.residualRelative.toExponential(2)}${root.branchId && persistent.has(root.branchId) ? " · persistent" : ""}</div>`).join("") : "No 3D-qualified root at the selected frame/tolerance.";
    if (parity) this.parityBox.innerHTML = `<b class="${parity.status === "PASS" ? "eq-pass" : "eq-fail"}">${parity.status}</b><br>R rel L2 ${parity.responseRelativeL2.toExponential(2)}<br>mean cos ${parity.meanResponseCosine.toFixed(7)}<br>eigen sign ${(100 * parity.eigenvalueSignAgreement).toFixed(3)}%<br>class ${(100 * parity.classificationAgreement).toFixed(3)}%`;
    else if (!hasWebGpu()) this.parityBox.innerHTML = `<b>HARDWARE RECEIPT NOT ISSUED</b><br>CPU reference remains active; WGSL static and synthetic gates still run.`;
  }

  private exportReceipt() {
    if (!this.packet) return;
    const receipt = {
      schema: "VOXELLAB_WEBGPU_EQ_MAP_BROWSER_NUMERIC_RECEIPT_V1",
      packet_id: this.packet.manifest.packet_id,
      source_hashes: this.packet.verifiedHashes,
      frame_index: this.frameIndex,
      frame_id: this.packet.manifest.frames[this.frameIndex]!.frame_id,
      time: this.packet.manifest.times[this.frameIndex],
      closure: this.closure,
      source_resolution: this.packet.manifest.grid.dimensions,
      receiver_resolution: [this.result?.width, this.result?.height],
      render_resolution: "CSS_PIXEL_DENSITY_SEPARATE",
      neutral_tolerance: this.neutralTolerance,
      root_algorithm: "FULL_3D_TRILINEAR_NEWTON_DENSITY_INDEPENDENT",
      qualified_roots: this.roots.map((root) => ({ id: root.id, branch_id: root.branchId, position: root.position, regime: root.regime, eigenvalues: root.stiffnessEigenvalues, residual_relative: root.residualRelative })),
      parity: this.lastParity,
      runtime_diagnostic: { adapter: this.lastAdapter, cached_compute_ms: this.lastGpuElapsedMs },
      claim_ceiling: "ACTION_READOUT_NOT_SOURCE_FORCE",
    };
    const blob = new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `WEBGPU_EQ_MAP_FRAME_${this.frameIndex}_${this.closure}.json`; link.click();
    URL.revokeObjectURL(url);
  }

  private drawMap() {
    if (!this.packet || !this.result) return;
    const result = this.result;
    this.canvas.width = result.width; this.canvas.height = result.height;
    const context = this.canvas.getContext("2d")!;
    const image = context.createImageData(result.width, result.height);
    const frame = frameVolume(this.packet, this.frameIndex, this.closure);
    const plane = this.plane();
    let rhoMax = 0;
    if (frame.rho) for (const value of frame.rho) rhoMax = Math.max(rhoMax, value);
    for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
      const i = y * result.width + x, color = COLORS[result.classes[i] ?? 0] ?? COLORS[0];
      let mixDensity = 0;
      if (this.densityOverlay) {
        const u = (2 * x / Math.max(result.width - 1, 1) - 1) * plane.extentU;
        const v = (2 * y / Math.max(result.height - 1, 1) - 1) * plane.extentV;
        const point: Vec3 = [plane.origin[0] + u * plane.axisU[0] + v * plane.axisV[0], plane.origin[1] + u * plane.axisU[1] + v * plane.axisV[1], plane.origin[2] + u * plane.axisU[2] + v * plane.axisV[2]];
        mixDensity = 0.35 * sampleDensity(frame, point) / Math.max(rhoMax, 1e-30);
      }
      image.data[i * 4] = color[0] * (1 - mixDensity) + 230 * mixDensity;
      image.data[i * 4 + 1] = color[1] * (1 - mixDensity) + 235 * mixDensity;
      image.data[i * 4 + 2] = color[2] * (1 - mixDensity) + 245 * mixDensity;
      image.data[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    context.save();
    // Numeric zero-crossing mask from κ_i, independent of the raster colors.
    context.fillStyle = "rgba(255,244,166,.88)";
    for (let y = 0; y < result.height - 1; y++) for (let x = 0; x < result.width - 1; x++) {
      const i = y * result.width + x;
      const right = i + 1, down = i + result.width;
      let crossing = false;
      for (let eigen = 0; eigen < 3; eigen++) {
        const value = result.eigenvalues[i * 3 + eigen]!;
        if (value * result.eigenvalues[right * 3 + eigen]! < 0 || value * result.eigenvalues[down * 3 + eigen]! < 0) crossing = true;
      }
      if (crossing) context.fillRect(x, y, 1, 1);
    }
    context.strokeStyle = "rgba(255,255,255,.38)"; context.lineWidth = 0.7;
    const stride = Math.max(9, Math.round(result.width / 28));
    for (let y = stride / 2; y < result.height; y += stride) for (let x = stride / 2; x < result.width; x += stride) {
      const i = Math.floor(y) * result.width + Math.floor(x);
      const r: Vec3 = [result.response[i * 4]!, result.response[i * 4 + 1]!, result.response[i * 4 + 2]!];
      const ru = dot(r, plane.axisU), rv = dot(r, plane.axisV), length = Math.hypot(ru, rv);
      if (length < 1e-12) continue;
      context.beginPath(); context.moveTo(x - 3 * ru / length, y + 3 * rv / length); context.lineTo(x + 3 * ru / length, y - 3 * rv / length); context.stroke();
    }
    for (const root of this.roots) {
      const delta = subtract(root.position, plane.origin);
      const normal = this.packet.manifest.registered_geometry.normal;
      if (Math.abs(dot(delta, normal)) > Math.max(...frame.spacing) * 1.5) continue;
      const x = (dot(delta, plane.axisU) / plane.extentU + 1) * 0.5 * result.width;
      const y = (1 - (dot(delta, plane.axisV) / plane.extentV + 1) * 0.5) * result.height;
      if (x < 0 || x > result.width || y < 0 || y > result.height) continue;
      context.fillStyle = "#fff"; context.strokeStyle = "#111827"; context.lineWidth = 1.5;
      context.beginPath();
      if (root.regime.startsWith("SADDLE")) { context.moveTo(x, y - 6); context.lineTo(x + 6, y); context.lineTo(x, y + 6); context.lineTo(x - 6, y); context.closePath(); }
      else { context.arc(x, y, 5.5, 0, Math.PI * 2); }
      context.fill(); context.stroke();
    }
    context.restore();
  }

  private async buildBranches() {
    if (!this.packet) return;
    const generation = ++this.branchGeneration;
    const frameRoots: QualifiedRoot[][] = [];
    for (let frameIndex = 0; frameIndex < this.packet.manifest.frames.length; frameIndex++) {
      frameRoots.push(findQualifiedRoots(frameVolume(this.packet, frameIndex, this.closure), frameIndex, 2e-4, this.thresholds()));
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (generation !== this.branchGeneration) return;
    }
    this.branches = trackRootBranches(frameRoots, this.closure);
    const current = frameRoots[this.frameIndex];
    if (current) this.roots = current;
    this.drawTimeline(); this.updateReadouts(); this.drawMap();
  }

  private drawTimeline() {
    const context = this.timelineCanvas.getContext("2d")!;
    const { width, height } = this.timelineCanvas;
    context.fillStyle = "#10151d"; context.fillRect(0, 0, width, height);
    context.strokeStyle = "#2f3b4b"; context.lineWidth = 1;
    for (let frame = 0; frame < 36; frame += 5) { const x = 26 + frame / 35 * (width - 52); context.beginPath(); context.moveTo(x, 12); context.lineTo(x, height - 22); context.stroke(); }
    const persistent = this.branches.filter((branch) => branch.persistent);
    persistent.forEach((branch, branchIndex) => {
      context.strokeStyle = `hsl(${(branchIndex * 61 + 155) % 360} 74% 65%)`; context.lineWidth = 2; context.beginPath();
      branch.roots.forEach((root, index) => {
        const x = 26 + root.frameIndex / 35 * (width - 52);
        const y = 16 + (branchIndex + 0.5) / Math.max(persistent.length, 1) * (height - 42);
        if (!index) context.moveTo(x, y); else context.lineTo(x, y);
      }); context.stroke();
    });
    context.fillStyle = "#9aa8ba"; context.font = "11px ui-monospace, monospace"; context.fillText("t=0", 24, height - 7); context.fillText("t=70", width - 55, height - 7);
    if (!persistent.length) { context.fillStyle = "#d8dee8"; context.fillText("No branch survives the preregistered two-frame persistence gate.", 40, height / 2); }
  }
}
