import type { FirstHitResult } from "../app/contracts";
import {
  computeChrysanthemum,
  sharedFrontChange,
  type ChrysanthemumGeometryMode,
  type ChrysanthemumMetrics,
} from "./chrysanthemumScale";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing Chrysanthemum element ${selector}`);
  return value;
}

function depthColor(value: number, mean: number) {
  if (!Number.isFinite(value)) return "#111820";
  const x = Math.max(-1, Math.min(1, Math.log(value / Math.max(mean, 1e-30)) / 0.9));
  const hue = 190 - 150 * x;
  return `hsl(${hue} 78% 58%)`;
}

function drawSky(canvas: HTMLCanvasElement, result: FirstHitResult, metrics: ChrysanthemumMetrics) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(210,230,240,.2)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  const size = result.direction_count >= 12000 ? 1.3 : 2.2;
  for (let i = 0; i < result.directions.length; i += 1) {
    const d = result.directions[i]!;
    const lon = Math.atan2(d[2], d[0]);
    const lat = Math.asin(Math.max(-1, Math.min(1, d[1])));
    const x = (lon / (2 * Math.PI) + 0.5) * w;
    const y = (0.5 - lat / Math.PI) * h;
    const depth = result.distances[i]!;
    ctx.fillStyle = depthColor(depth, metrics.meanDepth);
    ctx.fillRect(x, y, size, size);
  }
  ctx.fillStyle = "rgba(220,235,244,.72)";
  ctx.font = "11px system-ui";
  ctx.fillText("longitude →", w - 88, h - 8);
  ctx.save();
  ctx.translate(10, 72);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("latitude", 0, 0);
  ctx.restore();
}

function drawOwners(canvas: HTMLCanvasElement, fractions: readonly number[]) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, w, h);
  const tiers = fractions.map((v, i) => ({ tier: i, value: v ?? 0 })).filter((x) => x.tier > 0 && x.value > 0);
  if (!tiers.length) return;
  const pad = 42, gap = 8;
  const bw = Math.max(8, (w - 2 * pad - gap * (tiers.length - 1)) / tiers.length);
  ctx.strokeStyle = "rgba(210,230,240,.25)";
  ctx.beginPath(); ctx.moveTo(pad, 12); ctx.lineTo(pad, h - 30); ctx.lineTo(w - 12, h - 30); ctx.stroke();
  tiers.forEach((entry, i) => {
    const bh = entry.value * (h - 55);
    const x = pad + i * (bw + gap);
    ctx.fillStyle = `hsl(${170 + 22 * i} 65% 55%)`;
    ctx.fillRect(x, h - 30 - bh, bw, bh);
    ctx.fillStyle = "#cfe0e7";
    ctx.font = "11px system-ui";
    ctx.fillText(`K${entry.tier}`, x + 2, h - 14);
    ctx.fillText(`${(100 * entry.value).toFixed(entry.value < 0.01 ? 2 : 1)}%`, x, Math.max(16, h - 35 - bh));
  });
}

export class ChrysanthemumScalePanel {
  private generation = 0;
  private readonly sky: HTMLCanvasElement;
  private readonly owners: HTMLCanvasElement;
  private readonly readout: HTMLElement;
  private readonly status: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <section class="chrys-scale-card" id="action-lab-chrysanthemum-scale-v1">
        <header class="chrys-scale-header">
          <div><p class="chrys-kicker">R6 · EXTERNAL COUNTER-BOUNDARY DIAGNOSTIC</p><h2>Chrysanthemum · external support scale</h2>
          <p>Does a first-hit terminal front saturate locally while the material compensation scale remains environmental?</p></div>
          <span>GEOMETRY / FIRST-HIT DIAGNOSTIC · NOT TOTAL FORCE</span>
        </header>
        <div class="chrys-firewall"><b>Separate the objects:</b> material cavity = amount redistribution of the continuous substrate. Chrysanthemum = directional terminal-depth surface R<sub>term</sub>(Ω) produced by external positive centres. S10 enlarges external body radius to 1.4 to close the sky; this is an inserted diagnostic closure aid, not a physical constant.</div>
        <div class="chrys-controls">
          <label>KOU tiers <input id="chrys-tiers" type="range" min="1" max="8" step="1" value="4"><output id="chrys-tiers-label">4</output></label>
          <label>support radius <input id="chrys-radius" type="range" min="0.2" max="1.6" step="0.05" value="1.4"><output id="chrys-radius-label">1.40</output></label>
          <label>angular rays <select id="chrys-rays"><option>1024</option><option>4096</option><option selected>16384</option></select></label>
          <label>external geometry <select id="chrys-geometry"><option value="ORDERED_ANTIPODAL">ordered antipodal</option><option value="RANDOM_ANTIPODAL">random antipodal</option></select></label>
          <label>random seed <input id="chrys-seed" type="number" min="1" max="999999" value="1701"></label>
        </div>
        <div class="chrys-grid">
          <article><h3>Terminal-depth sky</h3><p>Colour = first positive external owner depth / mean depth. Dark = uncovered direction.</p><canvas id="chrys-sky" width="720" height="360"></canvas></article>
          <article><h3>Who actually holds the front?</h3><p>Fraction of covered directions whose first terminal owner belongs to each KOU tier.</p><canvas id="chrys-owners" width="720" height="360"></canvas></article>
        </div>
        <div id="chrys-readout" class="chrys-readout"></div>
        <div class="chrys-thesis"><b>Intrinsic-front discriminator:</b> after some finite K<sub>sat</sub>, coverage≈1, adding farther tiers should leave R<sub>term</sub>(Ω) unchanged while the normalized lobe amplitude remains finite under angular refinement. That is a local external support scale. It is not the same observable as the global M<sub>+</sub>≈M<sub>−</sub> compensation radius.</div>
        <div id="chrys-status" class="chrys-status">ready</div>
      </section>`;
    this.sky = required(root, "#chrys-sky");
    this.owners = required(root, "#chrys-owners");
    this.readout = required(root, "#chrys-readout");
    this.status = required(root, "#chrys-status");
    this.bind();
    this.schedule();
  }

  private bind() {
    for (const selector of ["#chrys-tiers", "#chrys-radius", "#chrys-rays", "#chrys-geometry", "#chrys-seed"]) {
      required<HTMLInputElement | HTMLSelectElement>(this.root, selector).addEventListener("input", () => this.schedule());
      required<HTMLInputElement | HTMLSelectElement>(this.root, selector).addEventListener("change", () => this.schedule());
    }
  }

  private schedule() {
    const generation = ++this.generation;
    this.status.textContent = "computing first-hit terminal front…";
    requestAnimationFrame(() => {
      if (generation !== this.generation) return;
      this.render(generation);
    });
  }

  private render(generation: number) {
    const tiers = Number(required<HTMLInputElement>(this.root, "#chrys-tiers").value);
    const radius = Number(required<HTMLInputElement>(this.root, "#chrys-radius").value);
    const rays = Number(required<HTMLSelectElement>(this.root, "#chrys-rays").value);
    const geometry = required<HTMLSelectElement>(this.root, "#chrys-geometry").value as ChrysanthemumGeometryMode;
    const seed = Number(required<HTMLInputElement>(this.root, "#chrys-seed").value);
    required<HTMLOutputElement>(this.root, "#chrys-tiers-label").value = String(tiers);
    required<HTMLOutputElement>(this.root, "#chrys-radius-label").value = radius.toFixed(2);

    const started = performance.now();
    const current = computeChrysanthemum(tiers, radius, rays, geometry, seed);
    const previous = tiers > 1 ? computeChrysanthemum(tiers - 1, radius, rays, geometry, seed) : null;
    if (generation !== this.generation) return;
    const elapsed = performance.now() - started;

    drawSky(this.sky, current.result, current.metrics);
    drawOwners(this.owners, current.metrics.tierFractions);

    const addedCoverage = previous ? current.metrics.coverage - previous.metrics.coverage : Number.NaN;
    const sharedChange = previous ? sharedFrontChange(current.result, previous.result) : Number.NaN;
    const ownerText = current.metrics.tierFractions
      .map((fraction, tier) => tier > 0 && fraction > 0 ? `K${tier} ${(100 * fraction).toFixed(fraction < 0.01 ? 2 : 1)}%` : "")
      .filter(Boolean).join(" · ");
    const saturated = current.metrics.coverage >= 0.9999 && previous && previous.metrics.coverage >= 0.9999 && sharedChange <= 1e-10;

    this.readout.innerHTML = `
      coverage=<b>${(100 * current.metrics.coverage).toFixed(3)}%</b> · mean R<sub>term</sub>=${current.metrics.meanDepth.toFixed(4)} · CV=${current.metrics.coefficientOfVariation.toFixed(4)} · robust lobe amplitude=${current.metrics.robustLobeAmplitude.toFixed(4)}<br>
      K−1 → K: Δcoverage=${Number.isFinite(addedCoverage) ? (100 * addedCoverage).toFixed(3) + "%" : "—"} · shared-front relative RMS change=${Number.isFinite(sharedChange) ? sharedChange.toExponential(3) : "—"}<br>
      owners: ${ownerText || "none"}<br>
      <b>${saturated ? "LOCAL TERMINAL FRONT SATURATED IN THIS DIAGNOSTIC" : "terminal front still depends on added support / uncovered directions"}</b>`;
    this.status.textContent = `${geometry} · ${current.bodies.length} positive external bodies · ${rays.toLocaleString()} rays · ${elapsed.toFixed(1)} ms`;
  }
}
