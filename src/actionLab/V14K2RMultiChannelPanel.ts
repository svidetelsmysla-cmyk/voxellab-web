import { findQualifiedRoots, samplePlaneCpu } from "./equilibriumGpu/cpuReference";
import { hasWebGpu, samplePlaneWebGpu } from "./equilibriumGpu/gpuContext";
import { loadMultiChannelPacket, multiChannelFrameVolume, REQUIRED_V14K2R_CHANNELS } from "./equilibriumGpu/multiChannelPacketLoader";
import type { LoadedMultiChannelPacket, MultiChannelTimeline, V14K2RChannelId } from "./equilibriumGpu/multiChannelTypes";
import { DEFAULT_THRESHOLDS, type PlaneResult, type QualifiedRoot } from "./equilibriumGpu/types";

const PACKET_URL = `${import.meta.env.BASE_URL}packets/v14k2r-n54-multichannel-v1`;
const COLORS = [[45,51,60],[29,176,138],[239,144,68],[218,92,73],[139,74,207],[232,215,113]] as const;
const LABELS: Record<V14K2RChannelId, string> = {
  ACTION_K2_STATE_MINUS_REFERENCE_W1_FINITE: "Action readout · finite box",
  ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC: "Action readout · nearest periodic",
  SOURCE_MATERIAL_FORCE_PERIODIC: "Source material force · periodic",
  SOURCE_ACTION_FORCE_PERIODIC: "Source action force · periodic",
  SOURCE_TOTAL_FORCE_PERIODIC: "Source total force · periodic",
};
interface FullTimelineDecision {
  timeline_index_sha256: string;
  source_total: { roots: number; persistent_branches: number; persistent_restoring_branches: number };
  g11r: { decision: string };
  g12r: { decision: string; median_step_delta: number; decrease_fraction: number };
}

export class V14K2RMultiChannelPanel {
  private packet?: LoadedMultiChannelPacket;
  private timeline?: MultiChannelTimeline;
  private channel: V14K2RChannelId = "SOURCE_TOTAL_FORCE_PERIODIC";
  private frameIndex = 0;
  private roots: QualifiedRoot[] = [];
  private neutralTolerance = DEFAULT_THRESHOLDS.neutralTolerance;
  private generation = 0;
  private readonly canvas: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private readonly rootSummary: HTMLElement;
  private readonly backend: HTMLElement;
  private readonly fullTimeline: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `<section class="equilibrium-map-card" id="v14k2r-multichannel-g11r-v1">
      <header class="eq-header"><div><p class="eq-kicker">V14K2R · governed N54 playback</p><h2>Action ↔ source-force channel crosswalk</h2>
      <p class="eq-subtitle">One shared 3D root/Jacobian/eigen classifier; five explicitly separate response channels.</p></div>
      <div class="eq-badges"><span id="v14k2r-backend">LOADING</span><span>SOURCE-FORCE DIAGNOSTIC MAXIMUM</span><button id="v14k2r-export" type="button">Export receipt</button></div></header>
      <div class="eq-firewall"><strong>Firewall:</strong> W1 is action readout, not total source force. No per-channel tuning, dipole, upor, scale, validation or canon promotion.</div>
      <div class="eq-controls">
        <label>Channel <select id="v14k2r-channel">${REQUIRED_V14K2R_CHANNELS.map((id) => `<option value="${id}" ${id === this.channel ? "selected" : ""}>${LABELS[id]}</option>`).join("")}</select></label>
        <label>Governed frames <input id="v14k2r-frame" type="range" min="0" max="0" value="0" step="1"><output id="v14k2r-frame-label">pending</output></label>
      </div>
      <div class="eq-resolution-firewall"><span>source: <b>N54 (54³)</b></span><span>public: bounded playback subset</span><span>full packet: hash-linked governed artifact</span></div>
      <div class="eq-map-shell"><canvas id="v14k2r-map" width="193" height="145" aria-label="V14K2R multi-channel regime map"></canvas>
        <div class="eq-legend"><span class="well">restoring</span><span class="saddle1">saddle 1</span><span class="saddle2">saddle 2</span><span class="peak">repelling</span><span class="neutral">neutral</span><span class="unresolved">unresolved</span></div></div>
      <div class="eq-readouts"><article><h3>Qualified 3D roots</h3><div id="v14k2r-roots">pending</div></article>
      <article><h3>Channel semantics</h3><div id="v14k2r-semantics">pending</div></article>
      <article><h3>Full 151-frame gate</h3><div id="v14k2r-full-timeline">verifying governed receipt…</div></article>
      <article><h3>Provenance</h3><div id="v14k2r-status">verifying packet hashes…</div></article></div>
    </section>`;
    this.canvas = root.querySelector("#v14k2r-map")!;
    this.status = root.querySelector("#v14k2r-status")!;
    this.rootSummary = root.querySelector("#v14k2r-roots")!;
    this.backend = root.querySelector("#v14k2r-backend")!;
    this.fullTimeline = root.querySelector("#v14k2r-full-timeline")!;
    root.querySelector<HTMLSelectElement>("#v14k2r-channel")!.addEventListener("change", (event) => {
      this.channel = (event.currentTarget as HTMLSelectElement).value as V14K2RChannelId;
      void this.render();
    });
    root.querySelector<HTMLInputElement>("#v14k2r-frame")!.addEventListener("input", (event) => {
      this.frameIndex = Number((event.currentTarget as HTMLInputElement).value);
      void this.render();
    });
    root.querySelector<HTMLButtonElement>("#v14k2r-export")!.addEventListener("click", () => this.exportReceipt());
    void this.initialize();
  }

  private async initialize() {
    try {
      this.packet = await loadMultiChannelPacket(PACKET_URL);
      const timelineResponse = await fetch(`${PACKET_URL}/root_timeline.json`);
      if (timelineResponse.ok) this.timeline = await timelineResponse.json() as MultiChannelTimeline;
      const decisionResponse = await fetch(`${PACKET_URL}/full_timeline_decision.json`);
      if (!decisionResponse.ok) throw new Error(`full timeline receipt HTTP ${decisionResponse.status}`);
      const decision = await decisionResponse.json() as FullTimelineDecision;
      this.fullTimeline.innerHTML = `<b>${decision.g11r.decision}</b><br>${decision.source_total.roots.toLocaleString()} total roots · ${decision.source_total.persistent_restoring_branches.toLocaleString()} persistent restoring<br><b class="eq-fail">${decision.g12r.decision}</b><br>median Δ ${decision.g12r.median_step_delta.toExponential(3)} · decrease ${(100 * decision.g12r.decrease_fraction).toFixed(2)}%<br><code>${decision.timeline_index_sha256.slice(0, 20)}…</code>`;
      const slider = this.root.querySelector<HTMLInputElement>("#v14k2r-frame")!;
      slider.max = String(this.packet.manifest.frames.length - 1);
      this.status.innerHTML = `<b>PACKET VERIFIED</b><br>${this.packet.manifest.packet_id}<br><code>${this.packet.manifest.source.packet_payload_sha256.slice(0, 20)}…</code>`;
      await this.render();
    } catch (error) {
      this.backend.textContent = "PACKET BLOCKER";
      this.status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  private async render() {
    if (!this.packet) return;
    const generation = ++this.generation;
    const frame = multiChannelFrameVolume(this.packet, this.frameIndex, this.channel);
    const timelineChannel = this.timeline?.channels.find((item) => item.channel_id === this.channel);
    this.neutralTolerance = timelineChannel?.neutral_thresholds[this.frameIndex] ?? DEFAULT_THRESHOLDS.neutralTolerance;
    const thresholds = { ...DEFAULT_THRESHOLDS, neutralTolerance: this.neutralTolerance };
    this.roots = findQualifiedRoots(frame, this.frameIndex, 2e-4, thresholds);
    const geometry = this.packet.manifest.registered_geometry;
    const plane = { origin: [0,0,0] as const, axisU: geometry.axis_u, axisV: geometry.axis_v, extentU: 12, extentV: 12 };
    let result: PlaneResult;
    if (hasWebGpu()) {
      try {
        result = (await samplePlaneWebGpu(frame, plane, 193, 145, thresholds)).result;
        this.backend.textContent = "WEBGPU · SHARED CLASSIFIER";
      } catch {
        result = samplePlaneCpu(frame, plane, 193, 145, thresholds);
        this.backend.textContent = "CPU FALLBACK · SHARED CLASSIFIER";
      }
    } else {
      result = samplePlaneCpu(frame, plane, 129, 97, thresholds);
      this.backend.textContent = "CPU REFERENCE · SHARED CLASSIFIER";
    }
    if (generation !== this.generation) return;
    this.draw(result);
    const time = this.packet.manifest.times[this.frameIndex]!;
    this.root.querySelector<HTMLOutputElement>("#v14k2r-frame-label")!.value = `t=${time.toFixed(1)} · ${this.frameIndex + 1}/${this.packet.manifest.frames.length}`;
    const counts = Object.fromEntries(["RESTORING_ROOT","SADDLE_INDEX_1","SADDLE_INDEX_2","REPELLING_ROOT","NEUTRAL_DEGENERATE_ROOT","NONCONSERVATIVE_OR_NUMERICALLY_UNRESOLVED"].map((regime) => [regime, this.roots.filter((root) => root.regime === regime).length]));
    this.rootSummary.innerHTML = `<b>${this.roots.length} roots</b><br>restoring ${counts.RESTORING_ROOT} · saddles ${Number(counts.SADDLE_INDEX_1)+Number(counts.SADDLE_INDEX_2)} · repelling ${counts.REPELLING_ROOT} · neutral ${counts.NEUTRAL_DEGENERATE_ROOT}`;
    const descriptor = this.packet.manifest.channels.find((item) => item.channel_id === this.channel)!;
    this.root.querySelector<HTMLElement>("#v14k2r-semantics")!.innerHTML = `<b>${LABELS[this.channel]}</b><br>${descriptor.source_class}<br>closure ${descriptor.closure}<br>normalization NONE<br>${descriptor.claim_ceiling}`;
  }

  private draw(result: PlaneResult) {
    const context = this.canvas.getContext("2d")!;
    this.canvas.width = result.width; this.canvas.height = result.height;
    const image = context.createImageData(result.width, result.height);
    for (let index = 0; index < result.classes.length; index++) {
      const color = COLORS[result.classes[index]!] ?? COLORS[0];
      image.data[index * 4] = color[0]; image.data[index * 4 + 1] = color[1]; image.data[index * 4 + 2] = color[2]; image.data[index * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }

  private exportReceipt() {
    if (!this.packet) return;
    const receipt = {
      schema: "V14K2R_BROWSER_NUMERIC_RECEIPT_V1", packet_id: this.packet.manifest.packet_id,
      full_source_packet_payload_sha256: this.packet.manifest.source.packet_payload_sha256,
      channel: this.channel, frame_index: this.frameIndex, time: this.packet.manifest.times[this.frameIndex],
      neutral_tolerance: this.neutralTolerance, root_count: this.roots.length,
      classifier: "ONE_SHARED_CPU_WEBGPU_CLASSIFIER", w1_equals_total_force: false,
      claim_ceiling: "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
    };
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([`${JSON.stringify(receipt, null, 2)}\n`], { type: "application/json" }));
    anchor.download = "V14K2R_BROWSER_NUMERIC_RECEIPT_V1.json"; anchor.click(); URL.revokeObjectURL(anchor.href);
  }
}
