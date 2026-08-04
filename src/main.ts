import "./styles.css";

import { CpuWorkerClient } from "./cpuClient";
import { computeDirect, relativeResultDelta, vecMagnitude } from "./kernel";
import { builtInScenes, defaultSceneId, loadBuiltInScene } from "./scenes";
import { parsePacket, parseScene, ValidationError } from "./schema";
import { VoxelViewport } from "./threeView";
import type {
  BrowserPacket,
  ComputeResult,
  RepresentationMode,
  SceneDocument,
  SceneObject,
  Vec3,
  WebGpuStatus,
} from "./types";
import { initializeWebGpu, WebGpuBackend } from "./webgpu";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");

root.innerHTML = `
  <main class="lab-shell">
    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true"><span></span><i></i></div>
        <div>
          <p class="eyebrow">FORMED-BODY LABORATORY</p>
          <h1>VoxelLab Web <span>Interactive Preview Solver</span></h1>
        </div>
      </div>
      <div class="topbar-meta">
        <span class="status-chip preview">PREVIEW SOLVER</span>
        <span class="commit-chip" title="Application commit">commit <code id="app-commit"></code></span>
        <a href="https://github.com/svidetelsmysla-cmyk/voxellab-web" target="_blank" rel="noreferrer">Repository ↗</a>
      </div>
    </header>

    <section class="workspace">
      <aside class="panel left-panel" aria-label="Scene and body inspector">
        <div class="panel-heading">
          <div><p class="eyebrow">SCENE GRAPH</p><h2>Rigid groups</h2></div>
          <span id="object-count" class="count-pill"></span>
        </div>
        <label class="field-label" for="scene-select">Built-in scene</label>
        <select id="scene-select" data-testid="scene-select"></select>
        <p id="scene-description" class="scene-description"></p>
        <p id="scene-ceiling" class="claim-note"></p>
        <div id="scene-tree" class="scene-tree" data-testid="scene-tree"></div>
        <section class="inspector" aria-label="Selected body">
          <div class="section-rule"><span>SELECTED BODY</span></div>
          <h3 id="selected-name">—</h3>
          <dl class="property-grid">
            <dt>Role</dt><dd id="selected-role">—</dd>
            <dt>Group</dt><dd id="selected-group">—</dd>
            <dt>State</dt><dd id="selected-state">—</dd>
          </dl>
          <label class="field-label" for="representation-select">Representation</label>
          <select id="representation-select" data-testid="representation-select">
            <option value="RIGID_VOLUME">RIGID_VOLUME · primary</option>
            <option value="CM_CONTROL">CM_CONTROL · control only</option>
          </select>
          <label class="visibility-toggle"><input id="selected-visible" type="checkbox" checked /> Visible in viewport</label>
          <div class="numeric-grid">
            <label>Amount <output id="selected-amount">—</output></label>
            <label>Density <output id="selected-density">—</output></label>
            <label>k<sub>v</sub> <output id="selected-kv">—</output></label>
            <label>Voxels <output id="selected-voxels">—</output></label>
          </div>
        </section>
      </aside>

      <section class="viewport-column">
        <div class="viewport-head">
          <div>
            <p class="eyebrow">INTERACTIVE 3D SCENE</p>
            <h2 id="viewport-title">Movable rigid volume</h2>
          </div>
          <div class="legend" aria-label="Scene legend">
            <span><i class="dot rigid"></i>rigid volume</span>
            <span><i class="dot movable"></i>movable</span>
            <span><i class="dot control"></i>CM control</span>
            <span><i class="line force"></i>force</span>
            <span><i class="line torque"></i>torque</span>
          </div>
        </div>
        <div id="viewport" class="viewport" data-testid="viewport">
          <div class="viewport-overlay top-left"><span>ORBIT</span> drag · <span>PAN</span> right drag · <span>ZOOM</span> wheel</div>
          <div class="viewport-overlay bottom-left"><span id="frame-status">FRAME 0000</span><b id="motion-status">PAUSED</b></div>
          <div class="axis-glyph" aria-hidden="true"><i class="x">X</i><i class="y">Y</i><i class="z">Z</i></div>
        </div>
      </section>

      <aside class="panel right-panel" aria-label="Preview controls and result ledger">
        <div class="panel-heading">
          <div><p class="eyebrow">NUMERICAL PREVIEW</p><h2>Control desk</h2></div>
          <span id="run-lamp" class="run-lamp" aria-label="Stopped"></span>
        </div>
        <div class="transport" role="group" aria-label="Preview transport">
          <button id="run-button" class="primary" data-testid="run">Run</button>
          <button id="stop-button" data-testid="stop">Stop</button>
          <button id="step-button" data-testid="step">Step</button>
          <button id="reset-button" data-testid="reset">Reset</button>
        </div>
        <label class="field-label" for="step-size">Preview step size</label>
        <div class="range-row">
          <input id="step-size" type="range" min="0.0005" max="0.01" step="0.0005" value="0.0025" />
          <output id="step-size-value">0.0025</output>
        </div>
        <label class="field-label" for="backend-select">Compute backend</label>
        <select id="backend-select" data-testid="backend-select">
          <option value="AUTO">AUTO · WebGPU then CPU Worker</option>
          <option value="WEBGPU">WebGPU</option>
          <option value="CPU_WORKER">CPU Worker</option>
        </select>
        <div id="backend-status" class="backend-card" data-testid="backend-status">
          <span class="pulse"></span><div><strong>Checking browser compute…</strong><small>CPU fallback is always available.</small></div>
        </div>
        <div id="error-banner" class="error-banner" role="alert" hidden></div>
        <section class="readout">
          <div class="section-rule"><span>SELECTED RESULT</span></div>
          <div class="vector-readout"><span>Force</span><strong id="force-value">[0, 0, 0]</strong><small id="force-magnitude">|F| 0</small></div>
          <div class="vector-readout"><span>Torque</span><strong id="torque-value">[0, 0, 0]</strong><small id="torque-magnitude">|τ| 0</small></div>
        </section>
        <section class="ledger-grid">
          <div><span>Amount in</span><strong id="amount-in">—</strong></div>
          <div><span>Residual</span><strong id="amount-residual">—</strong></div>
          <div><span>Compute</span><strong id="compute-time">—</strong></div>
          <div><span>Backend</span><strong id="backend-used">—</strong></div>
        </section>
        <div class="authority-split">
          <div><span class="status-chip preview">PREVIEW</span><p>Interactive browser calculation. Engineering use only.</p></div>
          <div><span class="status-chip authority">AUTHORITATIVE</span><p>Read-only, hashed repository packet. No silent recomputation.</p></div>
        </div>
      </aside>
    </section>

    <section class="bottom-panel">
      <div class="bottom-card files-card">
        <p class="eyebrow">SCENE EXCHANGE</p><h3>Local JSON</h3>
        <div class="file-actions">
          <label class="file-button">Load scene<input id="scene-file" type="file" accept="application/json,.json" data-testid="scene-file" /></label>
          <button id="export-scene" data-testid="export-scene">Export scene</button>
          <label class="file-button authority-button">Load packet<input id="packet-file" type="file" accept="application/json,.json" data-testid="packet-file" /></label>
          <button id="load-demo-packet">Load governed demo</button>
        </div>
        <p id="file-status" class="muted">Imports stay in this browser tab.</p>
      </div>
      <div class="bottom-card history-card">
        <p class="eyebrow">FORCE HISTORY</p><h3>Selected body · last 48 steps</h3>
        <div id="force-history" class="force-history" aria-label="Force magnitude history"></div>
      </div>
      <div class="bottom-card comparison-card">
        <p class="eyebrow">REPRESENTATION CONTROL</p><h3>CM versus rigid volume</h3>
        <div class="comparison-row"><span>Relative force delta</span><strong id="comparison-delta">—</strong></div>
        <p>Same positive amounts and coefficient; representation changes only.</p>
      </div>
      <div id="packet-card" class="bottom-card packet-card" data-testid="packet-card">
        <p class="eyebrow">GOVERNED PACKET</p><h3 id="packet-verdict">No packet loaded</h3>
        <dl><dt>Producer</dt><dd><code id="packet-commit">—</code></dd><dt>Packet SHA</dt><dd><code id="packet-sha">—</code></dd><dt>Manifest SHA</dt><dd><code id="manifest-sha">—</code></dd></dl>
        <p id="packet-ceiling" class="claim-note">Authoritative status remains unavailable until a packet is loaded.</p>
      </div>
    </section>

    <footer>
      <span>VoxelLab MVP v1</span>
      <span>positive formed-body preview · no softening · no hidden backend</span>
      <strong>NO UPOR · NO DIPOLE · NO SCALE · NO VALIDATION</strong>
    </footer>
  </main>
`;

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing element ${selector}`);
  return value;
}

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  return Math.abs(value) < 1e-3 || Math.abs(value) >= 1e4 ? value.toExponential(3) : value.toFixed(5);
};

const formatVector = (value: Vec3): string => `[${value.map(formatNumber).join(", ")}]`;

class VoxelLabApp {
  private scene: SceneDocument = loadBuiltInScene(defaultSceneId);
  private initialScene: SceneDocument = structuredClone(this.scene);
  private selectedId = this.scene.objects[0]?.object_id ?? "";
  private result: ComputeResult | null = null;
  private readonly velocities = new Map<string, Vec3>();
  private readonly overrides = new Map<string, RepresentationMode>();
  private readonly cpu = new CpuWorkerClient();
  private webGpu: WebGpuBackend | null = null;
  private webGpuStatus: WebGpuStatus | null = null;
  private running = false;
  private stepping = false;
  private frame = 0;
  private runTimer: number | null = null;
  private forceHistory: number[] = [];
  private packet: BrowserPacket | null = null;
  private readonly viewport: VoxelViewport;

  constructor() {
    element<HTMLElement>("#app-commit").textContent = APP_COMMIT.slice(0, 12);
    const select = element<HTMLSelectElement>("#scene-select");
    Object.values(builtInScenes).forEach((item) => select.add(new Option(item.display_name, item.scene_id)));
    select.value = defaultSceneId;
    this.viewport = new VoxelViewport(element("#viewport"), (id) => this.selectBody(id));
    this.bindEvents();
    this.renderScene();
    void this.initializeBackends();
  }

  private bindEvents(): void {
    element<HTMLSelectElement>("#scene-select").addEventListener("change", (event) => {
      this.loadScene(loadBuiltInScene((event.target as HTMLSelectElement).value));
      if (this.scene.scene_id === "SCENE_05_PACKET_VIEWER_DEMO") void this.loadDemoPacket();
    });
    element<HTMLButtonElement>("#run-button").addEventListener("click", () => this.start());
    element<HTMLButtonElement>("#stop-button").addEventListener("click", () => this.stop());
    element<HTMLButtonElement>("#step-button").addEventListener("click", () => void this.step());
    element<HTMLButtonElement>("#reset-button").addEventListener("click", () => this.reset());
    element<HTMLInputElement>("#step-size").addEventListener("input", (event) => {
      element<HTMLOutputElement>("#step-size-value").value = (event.target as HTMLInputElement).value;
    });
    element<HTMLSelectElement>("#representation-select").addEventListener("change", (event) => {
      const body = this.selectedBody();
      if (!body) return;
      const mode = (event.target as HTMLSelectElement).value as RepresentationMode;
      this.overrides.set(body.object_id, mode);
      body.representation_mode = mode;
      body.geometry_type = mode === "CM_CONTROL" ? "SPHERE" : "VOXEL_GROUP";
      body.voxel_level = mode === "CM_CONTROL" ? "CM" : body.voxel_elements.length >= 27 ? "V1" : "V0";
      this.viewport.setScene(this.scene);
      this.viewport.setSelected(body.object_id);
      this.result = null;
      this.renderInspector();
      void this.updateComparison();
    });
    element<HTMLInputElement>("#selected-visible").addEventListener("change", (event) => {
      const body = this.selectedBody();
      if (!body) return;
      body.visible = (event.target as HTMLInputElement).checked;
      this.viewport.syncTransforms(this.scene);
      this.renderTree();
    });
    element<HTMLInputElement>("#scene-file").addEventListener("change", (event) => void this.importScene(event));
    element<HTMLInputElement>("#packet-file").addEventListener("change", (event) => void this.importPacket(event));
    element<HTMLButtonElement>("#export-scene").addEventListener("click", () => this.exportScene());
    element<HTMLButtonElement>("#load-demo-packet").addEventListener("click", () => void this.loadDemoPacket());
  }

  private async initializeBackends(): Promise<void> {
    const parityScene = loadBuiltInScene("SCENE_03_MOVABLE_RIGID_VOLUME");
    const cpuReference = computeDirect(parityScene);
    const initialized = await initializeWebGpu(parityScene, cpuReference);
    this.webGpu = initialized.backend;
    this.webGpuStatus = initialized.status;
    this.renderBackendStatus();
    await this.step(false);
  }

  private loadScene(scene: SceneDocument): void {
    this.stop();
    this.scene = parseScene(scene);
    this.initialScene = structuredClone(this.scene);
    this.selectedId = this.scene.objects[0]?.object_id ?? "";
    this.result = null;
    this.frame = 0;
    this.velocities.clear();
    this.overrides.clear();
    this.forceHistory = [];
    this.clearError();
    this.renderScene();
    void this.step(false);
  }

  private renderScene(): void {
    element<HTMLSelectElement>("#scene-select").value = this.scene.scene_id in builtInScenes ? this.scene.scene_id : "";
    element("#scene-description").textContent = this.scene.description;
    element("#scene-ceiling").textContent = `Does not claim: ${this.scene.does_not_claim}`;
    element("#viewport-title").textContent = this.scene.display_name;
    element("#object-count").textContent = `${this.scene.objects.length} bodies`;
    this.viewport.setScene(this.scene);
    this.renderTree();
    this.renderInspector();
    this.renderFrame();
    this.renderHistory();
    void this.updateComparison();
  }

  private renderTree(): void {
    const tree = element("#scene-tree");
    tree.replaceChildren();
    this.scene.objects.forEach((body) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `tree-row${body.object_id === this.selectedId ? " selected" : ""}`;
      row.dataset.objectId = body.object_id;
      row.innerHTML = `<span class="tree-icon ${body.representation_mode === "CM_CONTROL" ? "cm" : body.fixed_far ? "far" : "volume"}"></span><span class="tree-copy"><strong></strong><small></small></span><span class="lock">${body.world_locked ? "LOCK" : "MOVE"}</span>`;
      row.querySelector("strong")!.textContent = body.display_name;
      row.querySelector("small")!.textContent = `${body.body_role} · ${body.group_id}`;
      row.addEventListener("click", () => this.selectBody(body.object_id));
      tree.append(row);
    });
  }

  private selectBody(id: string): void {
    this.selectedId = id;
    this.viewport.setSelected(id);
    this.renderTree();
    this.renderInspector();
    this.renderResult();
    this.renderFrame();
  }

  private selectedBody(): SceneObject | undefined {
    return this.scene.objects.find((body) => body.object_id === this.selectedId);
  }

  private renderInspector(): void {
    const body = this.selectedBody();
    if (!body) return;
    element("#selected-name").textContent = body.display_name;
    element("#selected-role").textContent = body.body_role;
    element("#selected-group").textContent = body.group_id;
    element("#selected-state").textContent = body.world_locked ? "WORLD LOCKED" : "MOVABLE RIGID";
    element<HTMLSelectElement>("#representation-select").value = body.representation_mode;
    element<HTMLInputElement>("#selected-visible").checked = body.visible;
    element("#selected-amount").textContent = formatNumber(body.amount);
    element("#selected-density").textContent = formatNumber(body.density);
    element("#selected-kv").textContent = formatNumber(body.k_v);
    element("#selected-voxels").textContent = body.representation_mode === "CM_CONTROL" ? "1 control" : `${body.voxel_elements.length} · ${body.voxel_level}`;
  }

  private async compute(): Promise<ComputeResult> {
    const requested = element<HTMLSelectElement>("#backend-select").value;
    if ((requested === "AUTO" || requested === "WEBGPU") && this.webGpu) {
      return this.webGpu.compute(this.scene, this.overrides);
    }
    if (requested === "WEBGPU" && !this.webGpu) {
      throw new Error("WebGPU requested but unavailable or parity did not pass. Choose CPU Worker or AUTO.");
    }
    return this.cpu.compute(this.scene, this.overrides);
  }

  private async step(applyMotion = true): Promise<void> {
    if (this.stepping) return;
    this.stepping = true;
    try {
      this.clearError();
      const result = await this.compute();
      this.result = result;
      if (applyMotion) {
        const dt = Number(element<HTMLInputElement>("#step-size").value);
        for (const bodyResult of result.bodies) {
          const body = this.scene.objects.find((candidate) => candidate.object_id === bodyResult.object_id);
          if (!body || body.world_locked || !body.movable_translation) continue;
          const velocity = this.velocities.get(body.object_id) ?? [0, 0, 0];
          for (let axis = 0; axis < 3; axis += 1) {
            velocity[axis] = ((velocity[axis] ?? 0) + ((bodyResult.force[axis] ?? 0) / body.amount) * dt) * 0.997;
            body.transform.position[axis] = (body.transform.position[axis] ?? 0) + (velocity[axis] ?? 0) * dt;
          }
          this.velocities.set(body.object_id, velocity);
        }
        this.frame += 1;
      }
      this.viewport.syncTransforms(this.scene);
      this.viewport.updateResults(result);
      const selected = result.bodies.find((body) => body.object_id === this.selectedId);
      if (selected) this.forceHistory.push(vecMagnitude(selected.force));
      this.forceHistory = this.forceHistory.slice(-48);
      this.renderResult();
      this.renderFrame();
      this.renderHistory();
      await this.updateComparison();
    } catch (error) {
      this.stop();
      this.showError(error instanceof Error ? error.message : String(error));
    } finally {
      this.stepping = false;
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.renderRunState();
    const loop = async () => {
      if (!this.running) return;
      await this.step();
      if (this.running) this.runTimer = window.setTimeout(loop, 42);
    };
    void loop();
  }

  private stop(): void {
    this.running = false;
    if (this.runTimer !== null) window.clearTimeout(this.runTimer);
    this.runTimer = null;
    this.renderRunState();
  }

  private reset(): void {
    this.stop();
    this.scene = structuredClone(this.initialScene);
    this.velocities.clear();
    this.overrides.clear();
    this.result = null;
    this.frame = 0;
    this.forceHistory = [];
    this.clearError();
    this.renderScene();
    void this.step(false);
  }

  private renderRunState(): void {
    element("#motion-status").textContent = this.running ? "RUNNING" : "PAUSED";
    element("#motion-status").classList.toggle("active", this.running);
    element("#run-lamp").classList.toggle("active", this.running);
    element("#run-lamp").setAttribute("aria-label", this.running ? "Running" : "Stopped");
  }

  private renderFrame(): void {
    element("#frame-status").textContent = `FRAME ${this.frame.toString().padStart(4, "0")}`;
    const body = this.selectedBody();
    if (body) element("#viewport").dataset.selectedPosition = body.transform.position.join(",");
  }

  private renderResult(): void {
    const body = this.result?.bodies.find((candidate) => candidate.object_id === this.selectedId);
    const force: Vec3 = body?.force ?? [0, 0, 0];
    const torque: Vec3 = body?.torque ?? [0, 0, 0];
    element("#force-value").textContent = formatVector(force);
    element("#force-magnitude").textContent = `|F| ${formatNumber(vecMagnitude(force))}`;
    element("#torque-value").textContent = formatVector(torque);
    element("#torque-magnitude").textContent = `|τ| ${formatNumber(vecMagnitude(torque))}`;
    element("#amount-in").textContent = this.result ? formatNumber(this.result.amount_in) : "—";
    element("#amount-residual").textContent = this.result ? formatNumber(this.result.amount_residual) : "—";
    element("#compute-time").textContent = this.result ? `${this.result.compute_ms.toFixed(2)} ms` : "—";
    element("#backend-used").textContent = this.result?.backend ?? "—";
  }

  private renderHistory(): void {
    const holder = element("#force-history");
    holder.replaceChildren();
    const max = Math.max(...this.forceHistory, 1e-12);
    const values = this.forceHistory.length ? this.forceHistory : Array.from({ length: 24 }, (_, index) => 0.15 + index * 0.006);
    values.forEach((value, index) => {
      const bar = document.createElement("i");
      bar.style.height = `${Math.max(5, (value / max) * 100)}%`;
      bar.style.opacity = this.forceHistory.length ? "1" : `${0.14 + index * 0.008}`;
      holder.append(bar);
    });
  }

  private async updateComparison(): Promise<void> {
    try {
      const rigid = new Map(this.scene.objects.map((body) => [body.object_id, "RIGID_VOLUME" as const]));
      const cm = new Map(this.scene.objects.map((body) => [body.object_id, "CM_CONTROL" as const]));
      const rigidResult = computeDirect(this.scene, rigid);
      const cmResult = computeDirect(this.scene, cm);
      element("#comparison-delta").textContent = formatNumber(relativeResultDelta(rigidResult, cmResult));
    } catch {
      element("#comparison-delta").textContent = "OVERLAP / N-A";
    }
  }

  private renderBackendStatus(): void {
    const card = element("#backend-status");
    const status = this.webGpuStatus;
    const title = card.querySelector("strong")!;
    const detail = card.querySelector("small")!;
    if (status?.device && status.parity === "PASS") {
      card.className = "backend-card pass";
      title.textContent = "WebGPU ready · parity PASS";
      detail.textContent = `${status.detail} · max buffer ${status.limits.maxBufferSize ?? "n/a"}`;
    } else {
      card.className = "backend-card warning";
      title.textContent = "CPU Worker fallback active";
      detail.textContent = status ? `${status.detail} · secure=${status.secureContext} gpu=${status.navigatorGpu}` : "WebGPU unavailable";
    }
    card.dataset.parity = status?.parity ?? "NOT_AVAILABLE";
  }

  private async importScene(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = parseScene(JSON.parse(await file.text()));
      this.loadScene(parsed);
      element("#file-status").textContent = `Loaded scene ${parsed.scene_id} from ${file.name}`;
    } catch (error) {
      this.showError(error instanceof ValidationError ? error.issues.join(" · ") : String(error));
    } finally {
      input.value = "";
    }
  }

  private exportScene(): void {
    const blob = new Blob([`${JSON.stringify(this.scene, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${this.scene.scene_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    element("#file-status").textContent = `Exported ${link.download}`;
  }

  private async importPacket(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.setPacket(parsePacket(JSON.parse(await file.text())));
      element("#file-status").textContent = `Loaded governed packet ${file.name}`;
    } catch (error) {
      this.showError(error instanceof ValidationError ? error.issues.join(" · ") : String(error));
    } finally {
      input.value = "";
    }
  }

  private async loadDemoPacket(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}packets/R14_V2B3B_BROWSER_PACKET_V1.json`);
      if (!response.ok) throw new Error(`Packet request failed: HTTP ${response.status}`);
      this.setPacket(parsePacket(await response.json()));
      element("#file-status").textContent = "Loaded the governed V2B3B browser packet without recomputation.";
    } catch (error) {
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  private setPacket(packet: BrowserPacket): void {
    this.packet = packet;
    element("#packet-verdict").textContent = packet.verdict;
    element("#packet-commit").textContent = packet.producer_commit;
    element("#packet-sha").textContent = packet.packet_sha256.slice(0, 20);
    element("#manifest-sha").textContent = packet.manifest_sha256.slice(0, 20);
    element("#packet-ceiling").textContent = packet.claim_ceiling;
    element("#packet-card").classList.add("loaded");
  }

  private showError(message: string): void {
    const banner = element("#error-banner");
    banner.textContent = message;
    banner.hidden = false;
  }

  private clearError(): void {
    const banner = element("#error-banner");
    banner.hidden = true;
    banner.textContent = "";
  }
}

new VoxelLabApp();
