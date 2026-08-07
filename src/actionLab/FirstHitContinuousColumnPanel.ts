import {
  integrateBinaryFirstHitOwnership,
  integrateFirstHitContinuousColumns,
  selectedCell,
  singleSphereParity,
  type FormedClumpSphere,
  type FirstHitColumnResult,
} from "./firstHitContinuousColumn";
import type { Vec3 } from "./math";

interface A3Preset {
  id: string;
  label: string;
  receiver: Vec3;
  clumps: FormedClumpSphere[];
  note: string;
}

const PRESETS: A3Preset[] = [
  {
    id: "single-oracle",
    label: "Single sphere · oracle",
    receiver: [0, 0, 0],
    clumps: [{ id: "A", centre: [0, 0, 3], radius: 1, density: 1 }],
    note: "One formed continuous domain. The first-owner column must converge to the analytic volume integral and R13 CURVED_H_OMEGA route.",
  },
  {
    id: "occluded-pair",
    label: "Two clumps · angular overlap",
    receiver: [0, 0, 0],
    clumps: [
      { id: "A", centre: [-0.15, 0, 2.5], radius: 0.75, density: 1 },
      { id: "B", centre: [0.35, 0.05, 4.2], radius: 0.9, density: 1.35 },
    ],
    note: "The two formed domains do not overlap in 3D, but their angular silhouettes overlap. First entry selects one owner; only that owner's full continuous chord is counted.",
  },
  {
    id: "three-clump",
    label: "Three clumps · owner competition",
    receiver: [0, 0, 0],
    clumps: [
      { id: "A", centre: [-0.5, 0.02, 3], radius: 0.55, density: 1 },
      { id: "B", centre: [0.55, 0.2, 3.5], radius: 0.6, density: 1.2 },
      { id: "C", centre: [0, -0.45, 4.25], radius: 0.7, density: 0.85 },
    ],
    note: "Three independent formed domains. The atlas makes the owner partition explicit before any W0/W1/W2 readout is taken.",
  },
];

const OWNER_COLOURS: Record<string, readonly [number, number, number]> = {
  A: [53, 132, 228],
  B: [235, 116, 57],
  C: [88, 176, 108],
  D: [174, 95, 205],
};

function fmt(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) > 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)) return value.toExponential(4);
  return value.toFixed(digits);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function vectorText(value: Vec3): string {
  return `[${fmt(value[0], 5)}, ${fmt(value[1], 5)}, ${fmt(value[2], 5)}]`;
}

function renderCrossSection(preset: A3Preset, ray: Vec3, result: FirstHitColumnResult, selectedIndex: number): string {
  const width = 720;
  const height = 280;
  const margin = 34;
  const xs = [preset.receiver[0], ...preset.clumps.map((clump) => clump.centre[0] - clump.radius), ...preset.clumps.map((clump) => clump.centre[0] + clump.radius)];
  const zs = [preset.receiver[2], ...preset.clumps.map((clump) => clump.centre[2] - clump.radius), ...preset.clumps.map((clump) => clump.centre[2] + clump.radius)];
  const xMin = Math.min(...xs) - 0.5;
  const xMax = Math.max(...xs) + 0.5;
  const zMin = Math.min(...zs) - 0.35;
  const zMax = Math.max(...zs) + 0.35;
  const sx = (x: number) => margin + (x - xMin) / (xMax - xMin) * (width - 2 * margin);
  const sy = (z: number) => height - margin - (z - zMin) / (zMax - zMin) * (height - 2 * margin);
  const scaleX = (width - 2 * margin) / (xMax - xMin);
  const scaleZ = (height - 2 * margin) / (zMax - zMin);
  const selected = selectedCell(result, selectedIndex);
  const rayLength = zMax - zMin + 2;
  const end: Vec3 = [
    preset.receiver[0] + ray[0] * rayLength,
    preset.receiver[1] + ray[1] * rayLength,
    preset.receiver[2] + ray[2] * rayLength,
  ];

  const circles = preset.clumps.map((clump) => {
    const colour = OWNER_COLOURS[clump.id] ?? [120, 140, 170];
    const rx = clump.radius * scaleX;
    const ry = clump.radius * scaleZ;
    return `<ellipse cx="${sx(clump.centre[0])}" cy="${sy(clump.centre[2])}" rx="${rx}" ry="${ry}" fill="rgba(${colour[0]},${colour[1]},${colour[2]},0.14)" stroke="rgb(${colour[0]},${colour[1]},${colour[2]})" stroke-width="2" />
      <text x="${sx(clump.centre[0])}" y="${sy(clump.centre[2]) + 4}" text-anchor="middle" class="a3-svg-label">${escapeHtml(clump.id)}</text>`;
  }).join("");

  const ownerColour = selected.ownerId ? OWNER_COLOURS[selected.ownerId] ?? [255, 196, 72] : [150, 160, 174];
  const entryMarker = selected.entry === null ? "" : `<circle cx="${sx(preset.receiver[0] + ray[0] * selected.entry)}" cy="${sy(preset.receiver[2] + ray[2] * selected.entry)}" r="5" fill="#fff" stroke="rgb(${ownerColour[0]},${ownerColour[1]},${ownerColour[2]})" stroke-width="3" />`;
  const exitMarker = selected.exit === null ? "" : `<circle cx="${sx(preset.receiver[0] + ray[0] * selected.exit)}" cy="${sy(preset.receiver[2] + ray[2] * selected.exit)}" r="5" fill="rgb(${ownerColour[0]},${ownerColour[1]},${ownerColour[2]})" />`;

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="A3 first-hit continuous-column cross-section">
    <rect width="${width}" height="${height}" class="a3-svg-bg" />
    <line x1="${sx(preset.receiver[0])}" y1="${sy(preset.receiver[2])}" x2="${sx(end[0])}" y2="${sy(end[2])}" stroke="rgb(${ownerColour[0]},${ownerColour[1]},${ownerColour[2]})" stroke-width="2" stroke-dasharray="6 5" opacity="0.82" />
    ${circles}
    <circle cx="${sx(preset.receiver[0])}" cy="${sy(preset.receiver[2])}" r="7" class="a3-receiver" />
    <text x="${sx(preset.receiver[0]) + 10}" y="${sy(preset.receiver[2]) - 10}" class="a3-svg-label">receiver</text>
    ${entryMarker}${exitMarker}
  </svg>`;
}

function paintAtlas(canvas: HTMLCanvasElement, result: FirstHitColumnResult, mode: "owner" | "column"): void {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.createImageData(width, height);
  const maximumColumn = Math.max(1e-30, ...result.cells.map((cell) => cell.columnAmount));
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 18;
    image.data[i + 1] = 23;
    image.data[i + 2] = 32;
    image.data[i + 3] = 255;
  }
  for (const cell of result.cells) {
    const [x, y, z] = cell.direction;
    const longitude = Math.atan2(y, x);
    const latitude = Math.asin(Math.max(-1, Math.min(1, z)));
    const px = Math.max(0, Math.min(width - 1, Math.floor((longitude / (2 * Math.PI) + 0.5) * width)));
    const py = Math.max(0, Math.min(height - 1, Math.floor((0.5 - latitude / Math.PI) * height)));
    const offset = (py * width + px) * 4;
    if (!cell.ownerId) {
      image.data[offset] = 29;
      image.data[offset + 1] = 36;
      image.data[offset + 2] = 48;
      image.data[offset + 3] = 255;
      continue;
    }
    const colour = OWNER_COLOURS[cell.ownerId] ?? [150, 160, 174];
    const intensity = mode === "owner" ? 1 : 0.18 + 0.82 * Math.sqrt(cell.columnAmount / maximumColumn);
    image.data[offset] = Math.round(colour[0] * intensity);
    image.data[offset + 1] = Math.round(colour[1] * intensity);
    image.data[offset + 2] = Math.round(colour[2] * intensity);
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

export class FirstHitContinuousColumnPanel {
  private readonly root: HTMLElement;
  private presetId = PRESETS[0]!.id;
  private sampleCount = 12288;
  private selectedIndex = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
  }

  private currentPreset(): A3Preset {
    return PRESETS.find((preset) => preset.id === this.presetId) ?? PRESETS[0]!;
  }

  private render(): void {
    const preset = this.currentPreset();
    const result = integrateFirstHitContinuousColumns(preset.receiver, preset.clumps, this.sampleCount);
    const binary = integrateBinaryFirstHitOwnership(preset.receiver, preset.clumps, this.sampleCount);
    const firstHit = result.cells.find((cell) => cell.ownerId !== null);
    if (firstHit && (this.selectedIndex >= result.cells.length || result.cells[this.selectedIndex]?.ownerId === null)) this.selectedIndex = firstHit.index;
    const selected = selectedCell(result, this.selectedIndex);
    const parity = singleSphereParity(preset.receiver, preset.clumps[0]!, Math.max(this.sampleCount, 49152));
    const ownerRows = preset.clumps.map((clump) => `<tr><td><span class="a3-owner-dot" style="--owner:${`rgb(${(OWNER_COLOURS[clump.id] ?? [150, 160, 174]).join(",")})`}"></span>${escapeHtml(clump.id)}</td><td>${result.ownerCounts[clump.id] ?? 0}</td><td>${fmt((result.ownerCounts[clump.id] ?? 0) / result.sampleCount, 5)}</td><td>${fmt(clump.density, 3)}</td></tr>`).join("");

    this.root.innerHTML = `<section class="a3-panel" data-testid="a3-first-hit-column">
      <header class="a3-header">
        <div>
          <p class="a3-kicker">Action Transport Lab · A3</p>
          <h2>First-hit continuous column</h2>
          <p>First hit selects the <strong>formed-domain owner</strong>. The same internally continuous owner is then integrated through its complete entry→exit chord. No internal voxel is a second hit; no post-hit scattering law is used.</p>
        </div>
        <div class="a3-status"><span>PROJECT METHOD / BROWSER ORACLE</span><strong>NO PHYSICAL VALIDATION</strong></div>
      </header>

      <div class="a3-controls">
        <label>Fixture
          <select id="a3-preset">
            ${PRESETS.map((item) => `<option value="${item.id}" ${item.id === this.presetId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
          </select>
        </label>
        <label>Angular directions
          <select id="a3-samples">
            ${[3072, 12288, 49152].map((count) => `<option value="${count}" ${count === this.sampleCount ? "selected" : ""}>${count.toLocaleString()}</option>`).join("")}
          </select>
        </label>
        <label>Selected angular cell
          <input id="a3-cell" type="range" min="0" max="${result.sampleCount - 1}" value="${this.selectedIndex}" step="1" />
          <output>${this.selectedIndex}</output>
        </label>
      </div>

      <p class="a3-note">${escapeHtml(preset.note)}</p>

      <div class="a3-grid a3-grid-main">
        <article class="a3-card">
          <div class="a3-card-title"><span>Geometry</span><small>first contour entry → full chord</small></div>
          <div class="a3-cross-section">${renderCrossSection(preset, selected.direction, result, this.selectedIndex)}</div>
          <dl class="a3-selected-readout">
            <div><dt>owner</dt><dd>${selected.ownerId ?? "OPEN SKY"}</dd></div>
            <div><dt>entry</dt><dd>${selected.entry === null ? "—" : fmt(selected.entry)}</dd></div>
            <div><dt>exit</dt><dd>${selected.exit === null ? "—" : fmt(selected.exit)}</dd></div>
            <div><dt>H(Ω) chord</dt><dd>${fmt(selected.chord)}</dd></div>
            <div><dt>q</dt><dd>${fmt(selected.density)}</dd></div>
            <div><dt>q·H·dΩ</dt><dd>${fmt(selected.columnAmount)}</dd></div>
          </dl>
        </article>

        <article class="a3-card">
          <div class="a3-card-title"><span>Angular ownership</span><small>binary K0 control</small></div>
          <canvas id="a3-owner-atlas" width="480" height="240" aria-label="A3 binary first-owner atlas"></canvas>
          <div class="a3-card-title a3-subtitle"><span>Continuous column</span><small>owner + q·H(Ω)</small></div>
          <canvas id="a3-column-atlas" width="480" height="240" aria-label="A3 continuous-column atlas"></canvas>
        </article>
      </div>

      <div class="a3-grid a3-grid-readouts">
        <article class="a3-card">
          <h3>Operator ladder</h3>
          <table><thead><tr><th>lane</th><th>uses</th><th>status</th></tr></thead><tbody>
            <tr><td>K0 Binary</td><td>owner + dΩ</td><td>control</td></tr>
            <tr class="a3-active"><td>K1 Column</td><td>owner + H(Ω) + q</td><td>active browser oracle</td></tr>
            <tr><td>K2 q(s)</td><td>owner + ∫q(s)ds</td><td>uniform q in this A3 fixture</td></tr>
            <tr><td>K3 hSq parity</td><td>source-reduced amount</td><td>one-sphere oracle</td></tr>
          </tbody></table>
        </article>

        <article class="a3-card">
          <h3>Current readout</h3>
          <dl class="a3-metrics">
            <div><dt>open sky</dt><dd>${result.openSkyCount} / ${result.sampleCount}</dd></div>
            <div><dt>binary Ω coverage</dt><dd>${fmt(binary.coverageSolidAngle)}</dd></div>
            <div><dt>column W0</dt><dd>${fmt(result.w0)}</dd></div>
            <div><dt>column W1</dt><dd>${vectorText(result.w1)}</dd></div>
            <div><dt>|W1|</dt><dd>${fmt(result.w1Magnitude)}</dd></div>
            <div><dt>diag W2</dt><dd>[${fmt(result.w2[0][0], 4)}, ${fmt(result.w2[1][1], 4)}, ${fmt(result.w2[2][2], 4)}]</dd></div>
          </dl>
        </article>

        <article class="a3-card">
          <h3>Owner ledger</h3>
          <table><thead><tr><th>owner</th><th>cells</th><th>fraction</th><th>q</th></tr></thead><tbody>${ownerRows}</tbody></table>
          <p class="a3-small">Exactly one first owner per hit angular cell. Behind-owner intersections are deliberately not counted at this level.</p>
        </article>
      </div>

      <article class="a3-card a3-oracle">
        <div class="a3-card-title"><span>Independent one-sphere parity</span><small>first clump alone</small></div>
        <table><thead><tr><th>route</th><th>W0</th><th>|W1|</th></tr></thead><tbody>
          <tr><td>analytic volume oracle</td><td>${fmt(parity.analyticW0)}</td><td>${fmt(parity.analyticW1)}</td></tr>
          <tr><td>R13 CURVED_H_OMEGA</td><td>${fmt(parity.curvedW0)}</td><td>${fmt(parity.curvedW1)}</td></tr>
          <tr class="a3-active"><td>A3 first-owner column</td><td>${fmt(parity.columnW0)}</td><td>${fmt(parity.columnW1)}</td></tr>
        </tbody></table>
        <p class="a3-parity">A3 relative error: W0 <strong>${fmt(parity.relativeW0Error, 6)}</strong> · W1 <strong>${fmt(parity.relativeW1Error, 6)}</strong></p>
      </article>

      <footer class="a3-footer">
        <strong>Interpretation ceiling:</strong>
        <code>FIRST_HIT_CONTINUOUS_COLUMN_BROWSER_METHOD_CONTROL</code>
        <span>No voxel-as-particle · no hard-sphere ontology · no scattering kernel · no Upor/dipole/scale/validation claim.</span>
      </footer>
    </section>`;

    const ownerCanvas = this.root.querySelector<HTMLCanvasElement>("#a3-owner-atlas");
    const columnCanvas = this.root.querySelector<HTMLCanvasElement>("#a3-column-atlas");
    if (ownerCanvas) paintAtlas(ownerCanvas, result, "owner");
    if (columnCanvas) paintAtlas(columnCanvas, result, "column");

    this.root.querySelector<HTMLSelectElement>("#a3-preset")?.addEventListener("change", (event) => {
      this.presetId = (event.target as HTMLSelectElement).value;
      this.selectedIndex = 0;
      this.render();
    });
    this.root.querySelector<HTMLSelectElement>("#a3-samples")?.addEventListener("change", (event) => {
      this.sampleCount = Number((event.target as HTMLSelectElement).value);
      this.selectedIndex = 0;
      this.render();
    });
    this.root.querySelector<HTMLInputElement>("#a3-cell")?.addEventListener("input", (event) => {
      this.selectedIndex = Number((event.target as HTMLInputElement).value);
      this.render();
    });
  }
}
