import type { FirstHitResult } from "../app/contracts";
import {
  asymptoticRawShellBudget,
  chrysanthemumShellScale,
  computeChrysanthemum,
  sharedFrontChange,
  type ChrysanthemumGeometryMode,
  type ChrysanthemumMetrics,
  type ChrysanthemumShellScaleRow,
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

function linearFit(rows: readonly ChrysanthemumShellScaleRow[]) {
  const usable = rows.filter((row) => row.openFraction > 0 && row.openFraction < 0.999999);
  if (usable.length < 3) return { hazard: Number.NaN, r2: Number.NaN };
  const x = usable.map((r) => r.tier);
  const y = usable.map((r) => Math.log(r.openFraction));
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i]! - mx, dy = y[i]! - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const slope = sxy / Math.max(sxx, 1e-30);
  return { hazard: -slope, r2: syy > 0 ? (sxy * sxy) / Math.max(sxx * syy, 1e-30) : 1 };
}

function drawScaleBridge(canvas: HTMLCanvasElement, rows: readonly ChrysanthemumShellScaleRow[], asymptotic: number) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#071018"; ctx.fillRect(0, 0, w, h);
  if (!rows.length) return;
  const padL = 58, padR = 20, top0 = 24, topH = 120, gap = 48, bot0 = top0 + topH + gap, botH = 120;
  const maxTier = Math.max(...rows.map((r) => r.tier));
  const X = (tier: number) => padL + (tier - 1) / Math.max(maxTier - 1, 1) * (w - padL - padR);

  const maxBudget = Math.max(asymptotic, ...rows.map((r) => r.rawShellSolidAngleBudget)) * 1.15;
  const Y1 = (value: number) => top0 + topH - value / Math.max(maxBudget, 1e-30) * topH;
  ctx.strokeStyle = "rgba(210,230,240,.25)";
  ctx.strokeRect(padL, top0, w - padL - padR, topH);
  ctx.strokeStyle = "rgba(242,199,107,.6)"; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(padL, Y1(asymptotic)); ctx.lineTo(w - padR, Y1(asymptotic)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "#55d6b3"; ctx.lineWidth = 2; ctx.beginPath();
  rows.forEach((row, i) => { const x = X(row.tier), y = Y1(row.rawShellSolidAngleBudget); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  ctx.fillStyle = "#cfe0e7"; ctx.font = "11px system-ui";
  ctx.fillText("raw shell Ω budget = Nₖ Ω_one / 4π", padL + 8, top0 + 16);
  ctx.fillStyle = "#f2c76b"; ctx.fillText(`asymptote ${asymptotic.toFixed(3)}`, w - 130, Math.max(top0 + 14, Y1(asymptotic) - 5));

  const positive = rows.filter((r) => r.openFraction > 0);
  const logs = positive.map((r) => Math.log10(r.openFraction));
  const minLog = Math.min(-0.5, ...logs) - 0.25, maxLog = 0;
  const Y2 = (value: number) => bot0 + botH - (value - minLog) / Math.max(maxLog - minLog, 1e-30) * botH;
  ctx.strokeStyle = "rgba(210,230,240,.25)"; ctx.strokeRect(padL, bot0, w - padL - padR, botH);
  ctx.strokeStyle = "#78b8ff"; ctx.lineWidth = 2; ctx.beginPath();
  let started = false;
  for (const row of rows) {
    if (!(row.openFraction > 0)) continue;
    const x = X(row.tier), y = Y2(Math.log10(row.openFraction));
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    ctx.fillStyle = "#78b8ff"; ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.fillStyle = "#cfe0e7"; ctx.fillText("log₁₀ open-sky fraction", padL + 8, bot0 + 16);
  rows.forEach((row) => { ctx.fillStyle = "#91a9b4"; ctx.fillText(`K${row.tier}`, X(row.tier) - 7, h - 9); });
}

export class ChrysanthemumScalePanel {
  private generation = 0;
  private readonly sky: HTMLCanvasElement;
  private readonly owners: HTMLCanvasElement;
  private readonly scaleBridge: HTMLCanvasElement;
  private readonly readout: HTMLElement;
  private readonly hazardReadout: HTMLElement;
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
          <label>support radius a <input id="chrys-radius" type="range" min="0.2" max="1.6" step="0.05" value="1.4"><output id="chrys-radius-label">1.40</output></label>
          <label>tier spacing s <input id="chrys-spacing" type="range" min="0.5" max="3" step="0.05" value="1.05"><output id="chrys-spacing-label">1.05</output></label>
          <label>angular rays <select id="chrys-rays"><option>1024</option><option>4096</option><option selected>16384</option></select></label>
          <label>external geometry <select id="chrys-geometry"><option value="ORDERED_ANTIPODAL">ordered antipodal</option><option value="RANDOM_ANTIPODAL">random antipodal</option></select></label>
          <label>random seed <input id="chrys-seed" type="number" min="1" max="999999" value="1701"></label>
        </div>
        <div class="chrys-grid">
          <article><h3>Terminal-depth sky</h3><p>Colour = first positive external owner depth / mean depth. Dark = uncovered direction.</p><canvas id="chrys-sky" width="720" height="360"></canvas></article>
          <article><h3>Who actually holds the front?</h3><p>Fraction of covered directions whose first terminal owner belongs to each KOU tier.</p><canvas id="chrys-owners" width="720" height="360"></canvas></article>
          <article class="chrys-wide"><h3>Power geometry → exponential angular closure</h3><p>The KOU shell has Nₖ=2mk² centres while one body's solid-angle footprint falls ≈rₖ⁻². Their raw product tends to a constant; first-hit converts repeated shell opportunities into the survival/open fraction.</p><canvas id="chrys-scale-bridge" width="1440" height="360"></canvas><div id="chrys-hazard-readout" class="chrys-readout"></div></article>
        </div>
        <div id="chrys-readout" class="chrys-readout"></div>
        <div class="chrys-thesis"><b>Intrinsic-front discriminator:</b> after some finite K<sub>sat</sub>, coverage≈1, adding farther tiers should leave R<sub>term</sub>(Ω) unchanged while the normalized lobe amplitude remains finite under angular refinement. That is a local external support scale. It is not the same observable as the global M<sub>+</sub>≈M<sub>−</sub> compensation radius.<br><br><b>Hierarchy bridge:</b> a statistically uniform family of finite centres has n∼m/(2πs³) in this KOU scaling and angular/geometric cross-section ∼πa², so its terminal-ownership length scales as ℓ<sub>term</sub>∼1/(nπa²). Move <b>a</b> and <b>s</b> together while keeping a/s fixed: pure geometric similarity predicts identical coverage, owner fractions and normalized terminal map, with R<sub>term</sub> scaling linearly. If a natural hierarchy reproduces this dimensionless relation without us imposing it, that is a candidate scale-transfer mechanism.<br><br>If a later natural hierarchy also has L<sub>j</sub>=L₀b<sup>j</sup> and an independently measured normalized mode P<sub>j</sub>=P₀s<sup>j</sup>, eliminating the hidden level index gives P(L)∝L<sup>ln(s)/ln(b)</sup>. This is a precise place where “two exponentials → power law” could enter the project; no exponent is asserted here.</div>
        <div id="chrys-status" class="chrys-status">ready</div>
      </section>`;
    this.sky = required(root, "#chrys-sky");
    this.owners = required(root, "#chrys-owners");
    this.scaleBridge = required(root, "#chrys-scale-bridge");
    this.readout = required(root, "#chrys-readout");
    this.hazardReadout = required(root, "#chrys-hazard-readout");
    this.status = required(root, "#chrys-status");
    this.bind();
    this.schedule();
  }

  private bind() {
    for (const selector of ["#chrys-tiers", "#chrys-radius", "#chrys-spacing", "#chrys-rays", "#chrys-geometry", "#chrys-seed"]) {
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
    const spacing = Number(required<HTMLInputElement>(this.root, "#chrys-spacing").value);
    const rays = Number(required<HTMLSelectElement>(this.root, "#chrys-rays").value);
    const geometry = required<HTMLSelectElement>(this.root, "#chrys-geometry").value as ChrysanthemumGeometryMode;
    const seed = Number(required<HTMLInputElement>(this.root, "#chrys-seed").value);
    required<HTMLOutputElement>(this.root, "#chrys-tiers-label").value = String(tiers);
    required<HTMLOutputElement>(this.root, "#chrys-radius-label").value = radius.toFixed(2);
    required<HTMLOutputElement>(this.root, "#chrys-spacing-label").value = spacing.toFixed(2);

    const started = performance.now();
    const current = computeChrysanthemum(tiers, radius, rays, geometry, seed, spacing);
    const previous = tiers > 1 ? computeChrysanthemum(tiers - 1, radius, rays, geometry, seed, spacing) : null;
    if (generation !== this.generation) return;
    const elapsed = performance.now() - started;

    drawSky(this.sky, current.result, current.metrics);
    drawOwners(this.owners, current.metrics.tierFractions);
    const shellRows = chrysanthemumShellScale(current.result, current.bodies, radius, tiers, 3, spacing);
    const rawAsymptote = asymptoticRawShellBudget(radius, 3, spacing);
    drawScaleBridge(this.scaleBridge, shellRows, rawAsymptote);
    const fit = linearFit(shellRows);
    const finiteHazards = shellRows.map((r) => r.incrementalHazard).filter((v) => Number.isFinite(v) && v > 0);
    const meanHazard = finiteHazards.length ? finiteHazards.reduce((a, b) => a + b, 0) / finiteHazards.length : Number.NaN;
    const last = shellRows.at(-1);
    const m = 3;
    const centreNumberDensity = m / (2 * Math.PI * spacing ** 3);
    const rawLength = 1 / Math.max(centreNumberDensity * Math.PI * radius * radius, 1e-30);
    const fittedLength = Number.isFinite(fit.hazard) && fit.hazard > 0 ? spacing / fit.hazard : Number.NaN;
    this.hazardReadout.innerHTML = `Nₖ=6k² · rₖ=${spacing.toFixed(2)}(k+1) · a/s=${(radius / spacing).toFixed(4)} · exact raw shell Ω budget at K${tiers}=${last?.rawShellSolidAngleBudget.toFixed(4) ?? "—"} · asymptotic budget=${rawAsymptote.toFixed(4)}<br>
      open-sky exponential fit: h=${Number.isFinite(fit.hazard) ? fit.hazard.toFixed(4) : "—"}, R²=${Number.isFinite(fit.r2) ? fit.r2.toFixed(4) : "—"} · mean finite incremental hazard=${Number.isFinite(meanHazard) ? meanHazard.toFixed(4) : "—"}<br>
      uniform-shell density proxy n≈${centreNumberDensity.toFixed(4)} · raw terminal length 1/(nπa²)≈${rawLength.toFixed(3)} · fitted s/h≈${Number.isFinite(fittedLength) ? fittedLength.toFixed(3) : "—"} · measured mean finite R<sub>term</sub>=${current.metrics.meanDepth.toFixed(3)}<br>
      <small>Interpret as static geometry/ownership survival, not a physical ray flux or collision mean-free-path. The inverse-square factor is solid-angle footprint; exponential behaviour, when present, is produced by repeated first-owner closure.</small>`;

    const addedCoverage = previous ? current.metrics.coverage - previous.metrics.coverage : Number.NaN;
    const sharedChange = previous ? sharedFrontChange(current.result, previous.result) : Number.NaN;
    const ownerText = current.metrics.tierFractions
      .map((fraction, tier) => tier > 0 && fraction > 0 ? `K${tier} ${(100 * fraction).toFixed(fraction < 0.01 ? 2 : 1)}%` : "")
      .filter(Boolean).join(" · ");
    const saturated = current.metrics.coverage >= 0.9999 && previous && previous.metrics.coverage >= 0.9999 && sharedChange <= 1e-10;

    this.readout.innerHTML = `
      coverage=<b>${(100 * current.metrics.coverage).toFixed(3)}%</b> · mean R<sub>term</sub>=${current.metrics.meanDepth.toFixed(4)} · R<sub>term</sub>/a=${(current.metrics.meanDepth / Math.max(radius, 1e-30)).toFixed(4)} · R<sub>term</sub>/s=${(current.metrics.meanDepth / Math.max(spacing, 1e-30)).toFixed(4)} · CV=${current.metrics.coefficientOfVariation.toFixed(4)} · robust lobe amplitude=${current.metrics.robustLobeAmplitude.toFixed(4)}<br>
      K−1 → K: Δcoverage=${Number.isFinite(addedCoverage) ? (100 * addedCoverage).toFixed(3) + "%" : "—"} · shared-front relative RMS change=${Number.isFinite(sharedChange) ? sharedChange.toExponential(3) : "—"}<br>
      owners: ${ownerText || "none"}<br>
      <b>${saturated ? "LOCAL TERMINAL FRONT SATURATED IN THIS DIAGNOSTIC" : "terminal front still depends on added support / uncovered directions"}</b>`;
    this.status.textContent = `${geometry} · ${current.bodies.length} positive external bodies · ${rays.toLocaleString()} rays · ${elapsed.toFixed(1)} ms`;
  }
}
