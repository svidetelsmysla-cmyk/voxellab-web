import {
  buildProjectionDecomposition,
  createSyntheticTwoOwnerFixture,
  createSyntheticUniformSphereFixture,
  integrateContinuousFieldColumns,
  parseContinuousFieldSnapshot,
  signedReadoutDifference,
  validateContinuousFieldSnapshot,
  type ContinuousFieldActionReadout,
  type ContinuousFieldSnapshotV1,
  type ProjectionMode,
  type SignedActionMoment,
  type SyntheticBridgeFixture,
} from "./continuousFieldActionBridge";
import { analyticSphereOutside, type Vec3 } from "./math";

const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

type FixtureId = "UNIFORM_SPHERE" | "TWO_OWNER_COLUMN" | "UPLOADED_SNAPSHOT";

interface ActiveFixture {
  snapshot: ContinuousFieldSnapshotV1;
  receiver: Vec3;
  analyticSphere: { radius: number; density: number } | null;
  note: string;
}

function format(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return "0";
  if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e4) return value.toExponential(4);
  return value.toFixed(digits);
}

function formatVector(value: Vec3): string {
  return `[${format(value[0], 4)}, ${format(value[1], 4)}, ${format(value[2], 4)}]`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function relativeError(value: number, reference: number): number | null {
  if (reference === 0) return value === 0 ? 0 : null;
  return Math.abs(value - reference) / Math.abs(reference);
}

function defaultReceiver(snapshot: ContinuousFieldSnapshotV1): Vec3 {
  const maximum: Vec3 = [
    snapshot.origin[0] + snapshot.spacing[0] * (snapshot.dimensions[0] - 1),
    snapshot.origin[1] + snapshot.spacing[1] * (snapshot.dimensions[1] - 1),
    snapshot.origin[2] + snapshot.spacing[2] * (snapshot.dimensions[2] - 1),
  ];
  const centre: Vec3 = [
    0.5 * (snapshot.origin[0] + maximum[0]),
    0.5 * (snapshot.origin[1] + maximum[1]),
    0.5 * (snapshot.origin[2] + maximum[2]),
  ];
  const span = Math.max(
    maximum[0] - snapshot.origin[0],
    maximum[1] - snapshot.origin[1],
    maximum[2] - snapshot.origin[2],
  );
  return [centre[0], centre[1], snapshot.origin[2] - Math.max(span, 1)];
}

function emptySigned(): SignedActionMoment {
  return {
    w0: 0,
    w1: [0, 0, 0],
    w1Magnitude: 0,
    w2: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
}

function paintDensitySlice(
  canvas: HTMLCanvasElement,
  snapshot: ContinuousFieldSnapshotV1,
  receiver: Vec3,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const [nx, ny, nz] = snapshot.dimensions;
  const iy = Math.floor(ny / 2);
  const maximumDensity = snapshot.rho.reduce((maximum, value) => Math.max(maximum, value), 1e-30);
  context.fillStyle = "#07100f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const cellWidth = canvas.width / nx;
  const cellHeight = canvas.height / nz;
  for (let iz = 0; iz < nz; iz += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const index = ix + nx * (iy + ny * iz);
      const density = snapshot.rho[index] ?? 0;
      if (!(density > 0)) continue;
      const owner = snapshot.ownerIds?.[index] ?? 0;
      const intensity = Math.min(1, Math.sqrt(density / maximumDensity));
      const colour = owner === 1
        ? [81, 161, 237]
        : owner === 2
          ? [237, 135, 72]
          : [93, 201, 185];
      context.fillStyle = `rgba(${colour[0]},${colour[1]},${colour[2]},${0.16 + 0.84 * intensity})`;
      context.fillRect(
        ix * cellWidth,
        canvas.height - (iz + 1) * cellHeight,
        cellWidth + 1,
        cellHeight + 1,
      );
    }
  }

  context.strokeStyle = "rgba(255,255,255,.22)";
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  const xMax = snapshot.origin[0] + snapshot.spacing[0] * (nx - 1);
  const zMax = snapshot.origin[2] + snapshot.spacing[2] * (nz - 1);
  const receiverX = (receiver[0] - snapshot.origin[0]) / Math.max(xMax - snapshot.origin[0], 1e-30) * canvas.width;
  const receiverZ = canvas.height - (receiver[2] - snapshot.origin[2]) / Math.max(zMax - snapshot.origin[2], 1e-30) * canvas.height;
  const markerX = Math.max(8, Math.min(canvas.width - 8, receiverX));
  const markerY = Math.max(8, Math.min(canvas.height - 8, receiverZ));
  context.fillStyle = "#f0cf77";
  context.beginPath();
  context.arc(markerX, markerY, 5, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = "rgba(220,232,244,.8)";
  context.font = "11px system-ui";
  context.fillText("receiver", Math.min(canvas.width - 58, markerX + 8), Math.max(14, markerY - 7));
}

function paintAngularMap(canvas: HTMLCanvasElement, readout: ContinuousFieldActionReadout): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#07100f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const maximum = readout.cells.reduce((result, cell) => Math.max(result, cell.actionContribution), 1e-30);
  for (const cell of readout.cells) {
    if (!(cell.actionContribution > 0)) continue;
    const longitude = Math.atan2(cell.direction[1], cell.direction[0]);
    const latitude = Math.asin(Math.max(-1, Math.min(1, cell.direction[2])));
    const x = (longitude / (2 * Math.PI) + 0.5) * canvas.width;
    const y = (0.5 - latitude / Math.PI) * canvas.height;
    const intensity = 0.2 + 0.8 * Math.sqrt(cell.actionContribution / maximum);
    const colour = cell.firstOwnerId === 1
      ? [81, 161, 237]
      : cell.firstOwnerId === 2
        ? [237, 135, 72]
        : [106, 210, 189];
    context.fillStyle = `rgba(${colour[0]},${colour[1]},${colour[2]},${intensity})`;
    context.fillRect(Math.floor(x), Math.floor(y), 2, 2);
  }
  context.strokeStyle = "rgba(255,255,255,.18)";
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
}

function readoutRow(label: string, readout: ContinuousFieldActionReadout | SignedActionMoment): string {
  return `<tr>
    <td>${escapeHtml(label)}</td>
    <td>${format(readout.w0)}</td>
    <td>${format(readout.w1Magnitude)}</td>
    <td>${formatVector(readout.w1)}</td>
  </tr>`;
}

export class ContinuousFieldActionBridgePanel {
  private fixtureId: FixtureId = "UNIFORM_SPHERE";
  private projectionMode: ProjectionMode = "TRANSPARENT_FULL_COLUMN";
  private directionCount = 4096;
  private receiver: Vec3 = [0, 0, -3];
  private uploadedSnapshot: ContinuousFieldSnapshotV1 | null = null;
  private uploadedName = "";
  private message = "";

  constructor(private readonly root: HTMLElement) {
    this.render();
  }

  private activeFixture(): ActiveFixture {
    if (this.fixtureId === "UPLOADED_SNAPSHOT" && this.uploadedSnapshot) {
      return {
        snapshot: this.uploadedSnapshot,
        receiver: this.receiver,
        analyticSphere: null,
        note: `Loaded read-only snapshot: ${this.uploadedName || this.uploadedSnapshot.snapshotId}.`,
      };
    }
    const fixture: SyntheticBridgeFixture = this.fixtureId === "TWO_OWNER_COLUMN"
      ? createSyntheticTwoOwnerFixture(41)
      : createSyntheticUniformSphereFixture(41);
    return fixture;
  }

  private resetReceiverForFixture(): void {
    if (this.fixtureId === "UPLOADED_SNAPSHOT" && this.uploadedSnapshot) {
      this.receiver = defaultReceiver(this.uploadedSnapshot);
      return;
    }
    const fixture = this.fixtureId === "TWO_OWNER_COLUMN"
      ? createSyntheticTwoOwnerFixture(41)
      : createSyntheticUniformSphereFixture(41);
    this.receiver = fixture.receiver;
  }

  private render(): void {
    let fixture: ActiveFixture;
    let full: ContinuousFieldActionReadout;
    let firstOwner: ContinuousFieldActionReadout | null = null;
    let complementary = emptySigned();
    let error = "";

    try {
      fixture = this.activeFixture();
      const validation = validateContinuousFieldSnapshot(fixture.snapshot);
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      if (this.projectionMode === "FIRST_REGISTERED_OWNER_COLUMN" && !fixture.snapshot.ownerIds) {
        this.projectionMode = "TRANSPARENT_FULL_COLUMN";
        this.message = "Loaded snapshot has no ownerIds; first-owner lane remains blocked.";
      }
      const options = {
        directionCount: this.directionCount,
        stepLength: Math.min(...fixture.snapshot.spacing) * 0.5,
      };
      full = integrateContinuousFieldColumns(
        fixture.snapshot,
        this.receiver,
        "TRANSPARENT_FULL_COLUMN",
        options,
      );
      if (fixture.snapshot.ownerIds) {
        const decomposition = buildProjectionDecomposition(fixture.snapshot, this.receiver, options);
        firstOwner = decomposition.firstOwnerColumn;
        complementary = decomposition.complementarySignedDiagnostic;
      }
    } catch (caught) {
      error = String(caught);
      const fallback = createSyntheticUniformSphereFixture(33);
      fixture = fallback;
      full = integrateContinuousFieldColumns(
        fallback.snapshot,
        fallback.receiver,
        "TRANSPARENT_FULL_COLUMN",
        { directionCount: 2048 },
      );
      this.projectionMode = "TRANSPARENT_FULL_COLUMN";
    }

    const selected = this.projectionMode === "FIRST_REGISTERED_OWNER_COLUMN" && firstOwner
      ? firstOwner
      : full;
    const validation = validateContinuousFieldSnapshot(fixture.snapshot);
    const analytic = fixture.analyticSphere
      ? analyticSphereOutside(this.receiver, fixture.analyticSphere)
      : null;
    const w0Error = analytic ? relativeError(selected.w0, analytic.w0) : null;
    const w1Error = analytic ? relativeError(selected.w1Magnitude, analytic.w1Magnitude) : null;
    const frozenInput = fixture.snapshot.sourceClass !== "SYNTHETIC_ORACLE";
    const status = frozenInput
      ? "FROZEN SNAPSHOT LOADED · READ-ONLY"
      : "A4 METHOD READY · V14 SNAPSHOT EXPORT BLOCKER";

    this.root.innerHTML = `<section class="a4-panel" data-testid="a4-continuous-field-action-bridge-panel">
      <header class="a4-header">
        <div>
          <p class="a4-kicker">Action Transport Lab · A4 / V14 bridge</p>
          <h2>Continuous-field action bridge</h2>
          <p>Reads a cell-centred non-negative <code>ρ(x)</code> snapshot, integrates the real K2 column <code>Σ(x,Ω)=∫ρ(x+sΩ)ds</code>, and reports <code>W0/W1/W2</code> without feeding anything back into the solver.</p>
        </div>
        <div class="a4-status ${frozenInput ? "loaded" : "blocked"}" data-testid="a4-bridge-status">
          <span>${status}</span>
          <strong>W1 = DIRECTIONAL ACTION MOMENT · NOT PHYSICAL FORCE</strong>
        </div>
      </header>

      <div class="a4-firewall">
        <strong>Current authority boundary</strong>
        <span>Synthetic fixtures are method oracles only. No frozen V5/V6/V14 ρ packet is bundled in this branch, so physical comparison remains blocked.</span>
      </div>

      <div class="a4-controls">
        <label>Input fixture
          <select id="a4-fixture">
            <option value="UNIFORM_SPHERE" ${this.fixtureId === "UNIFORM_SPHERE" ? "selected" : ""}>Synthetic uniform sphere</option>
            <option value="TWO_OWNER_COLUMN" ${this.fixtureId === "TWO_OWNER_COLUMN" ? "selected" : ""}>Synthetic two-owner column</option>
            ${this.uploadedSnapshot ? `<option value="UPLOADED_SNAPSHOT" ${this.fixtureId === "UPLOADED_SNAPSHOT" ? "selected" : ""}>Uploaded frozen snapshot</option>` : ""}
          </select>
        </label>
        <label>Projection lane
          <select id="a4-mode">
            <option value="TRANSPARENT_FULL_COLUMN" ${this.projectionMode === "TRANSPARENT_FULL_COLUMN" ? "selected" : ""}>Transparent full column</option>
            <option value="FIRST_REGISTERED_OWNER_COLUMN" ${this.projectionMode === "FIRST_REGISTERED_OWNER_COLUMN" ? "selected" : ""} ${fixture.snapshot.ownerIds ? "" : "disabled"}>First registered owner</option>
          </select>
        </label>
        <label>Angular directions
          <select id="a4-directions">
            ${[2048, 4096, 8192, 16384].map((count) => `<option value="${count}" ${count === this.directionCount ? "selected" : ""}>${count.toLocaleString()}</option>`).join("")}
          </select>
        </label>
        <label>Receiver X <input id="a4-rx" type="number" step="0.05" value="${this.receiver[0]}"></label>
        <label>Receiver Y <input id="a4-ry" type="number" step="0.05" value="${this.receiver[1]}"></label>
        <label>Receiver Z <input id="a4-rz" type="number" step="0.05" value="${this.receiver[2]}"></label>
        <button id="a4-run" type="button">RUN READ-ONLY A4</button>
        <label class="a4-file-label">Load snapshot JSON
          <input id="a4-file" type="file" accept=".json,application/json">
        </label>
        <button id="a4-export" type="button">EXPORT A4 RECEIPT</button>
      </div>

      ${this.message ? `<p class="a4-message">${escapeHtml(this.message)}</p>` : ""}
      ${error ? `<p class="a4-error">${escapeHtml(error)}</p>` : ""}
      <p class="a4-note">${escapeHtml(fixture.note)}</p>

      <div class="a4-grid a4-grid-visual">
        <article class="a4-card">
          <div class="a4-card-title"><span>ρ snapshot slice</span><small>X–Z · centre Y plane</small></div>
          <canvas id="a4-density-slice" width="600" height="430" aria-label="A4 continuous density slice"></canvas>
          <p>Colour is the positive source density supplied by the snapshot. Owner colour is used only when <code>ownerIds</code> are source-exported.</p>
        </article>
        <article class="a4-card">
          <div class="a4-card-title"><span>Angular K2 map</span><small>Σ·dΩ for selected lane</small></div>
          <canvas id="a4-angular-map" width="600" height="300" aria-label="A4 angular continuous-column map"></canvas>
          <dl class="a4-selected-metrics">
            <div><dt>coverage</dt><dd>${format(selected.coverageFraction, 5)}</dd></div>
            <div><dt>open directions</dt><dd>${selected.openDirectionCount} / ${selected.directionCount}</dd></div>
            <div><dt>step length</dt><dd>${format(selected.stepLength)}</dd></div>
            <div><dt>source class</dt><dd>${fixture.snapshot.sourceClass}</dd></div>
          </dl>
        </article>
      </div>

      <div class="a4-grid a4-grid-readout">
        <article class="a4-card">
          <h3>Selected action moments</h3>
          <dl class="a4-metrics">
            <div><dt>W0</dt><dd>${format(selected.w0)}</dd></div>
            <div><dt>W1</dt><dd>${formatVector(selected.w1)}</dd></div>
            <div><dt>|W1|</dt><dd>${format(selected.w1Magnitude)}</dd></div>
            <div><dt>diag W2</dt><dd>[${format(selected.w2[0][0], 4)}, ${format(selected.w2[1][1], 4)}, ${format(selected.w2[2][2], 4)}]</dd></div>
            <div><dt>trace(W2) − W0</dt><dd>${format(selected.traceClosureAbsolute)}</dd></div>
            <div><dt>normalized dev(W2)</dt><dd>${format(selected.normalizedDeviatoricW2)}</dd></div>
          </dl>
        </article>

        <article class="a4-card">
          <h3>Real angular multipoles</h3>
          <dl class="a4-metrics">
            <div><dt>P1</dt><dd>${format(selected.multipoles.p1)}</dd></div>
            <div><dt>P2</dt><dd>${format(selected.multipoles.p2)}</dd></div>
            <div><dt>P3</dt><dd>${format(selected.multipoles.p3)}</dd></div>
            <div><dt>P4</dt><dd>${format(selected.multipoles.p4)}</dd></div>
          </dl>
          <p class="a4-small">P1–P4 are normalized powers of the positive angular action map. They are diagnostics, not new source laws.</p>
        </article>

        <article class="a4-card">
          <h3>Snapshot contract</h3>
          <dl class="a4-metrics">
            <div><dt>snapshot</dt><dd>${escapeHtml(fixture.snapshot.snapshotId)}</dd></div>
            <div><dt>grid</dt><dd>${fixture.snapshot.dimensions.join(" × ")}</dd></div>
            <div><dt>positive amount</dt><dd>${format(validation.totalPositiveAmount)}</dd></div>
            <div><dt>owner IDs</dt><dd>${validation.hasOwnerIds ? "SOURCE EXPORTED" : "NOT AVAILABLE"}</dd></div>
            <div><dt>source commit</dt><dd>${escapeHtml(fixture.snapshot.provenance.sourceCommit)}</dd></div>
            <div><dt>packet SHA256</dt><dd>${fixture.snapshot.provenance.sourcePacketSha256 ?? "NOT APPLICABLE / BLOCKED"}</dd></div>
          </dl>
        </article>
      </div>

      <article class="a4-card a4-decomposition">
        <div class="a4-card-title"><span>Projection decomposition</span><small>signed comparison only</small></div>
        <table>
          <thead><tr><th>lane</th><th>W0</th><th>|W1|</th><th>W1 vector</th></tr></thead>
          <tbody>
            ${readoutRow("transparent full column", full)}
            ${firstOwner ? readoutRow("first registered owner", firstOwner) : readoutRow("first registered owner · BLOCKED", emptySigned())}
            ${readoutRow("full − first owner · signed diagnostic", complementary)}
          </tbody>
        </table>
        <p><code>full − first owner</code> is a comparison between two positive source readouts. It is not negative matter, not an attenuation law, and not a physical-force decomposition.</p>
      </article>

      <article class="a4-card a4-oracle">
        <div class="a4-card-title"><span>Independent method oracle</span><small>${analytic ? "analytic uniform sphere" : "not available for this input"}</small></div>
        <dl class="a4-metrics">
          <div><dt>analytic W0</dt><dd>${analytic ? format(analytic.w0) : "—"}</dd></div>
          <div><dt>A4 W0 rel. error</dt><dd>${w0Error === null ? "—" : format(w0Error)}</dd></div>
          <div><dt>analytic |W1|</dt><dd>${analytic ? format(analytic.w1Magnitude) : "—"}</dd></div>
          <div><dt>A4 |W1| rel. error</dt><dd>${w1Error === null ? "—" : format(w1Error)}</dd></div>
        </dl>
      </article>

      <footer class="a4-footer">
        <code>A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER</code>
        <span>read-only · no feedback · no fitted transparency · no prescribed cavity · no cadence · no Upor/dipole/scale/validation/canon promotion</span>
        <small>commit ${APP_COMMIT.slice(0, 12)}</small>
      </footer>
    </section>`;

    const densityCanvas = this.root.querySelector<HTMLCanvasElement>("#a4-density-slice");
    const angularCanvas = this.root.querySelector<HTMLCanvasElement>("#a4-angular-map");
    if (densityCanvas) paintDensitySlice(densityCanvas, fixture.snapshot, this.receiver);
    if (angularCanvas) paintAngularMap(angularCanvas, selected);
    this.bind(fixture, full, firstOwner, complementary);
  }

  private bind(
    fixture: ActiveFixture,
    full: ContinuousFieldActionReadout,
    firstOwner: ContinuousFieldActionReadout | null,
    complementary: SignedActionMoment,
  ): void {
    this.root.querySelector<HTMLSelectElement>("#a4-fixture")?.addEventListener("change", (event) => {
      this.fixtureId = (event.target as HTMLSelectElement).value as FixtureId;
      this.resetReceiverForFixture();
      this.message = "";
      this.render();
    });
    this.root.querySelector<HTMLSelectElement>("#a4-mode")?.addEventListener("change", (event) => {
      this.projectionMode = (event.target as HTMLSelectElement).value as ProjectionMode;
      this.render();
    });
    this.root.querySelector<HTMLSelectElement>("#a4-directions")?.addEventListener("change", (event) => {
      this.directionCount = Number((event.target as HTMLSelectElement).value);
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("#a4-run")?.addEventListener("click", () => {
      const x = Number(this.root.querySelector<HTMLInputElement>("#a4-rx")?.value);
      const y = Number(this.root.querySelector<HTMLInputElement>("#a4-ry")?.value);
      const z = Number(this.root.querySelector<HTMLInputElement>("#a4-rz")?.value);
      if (![x, y, z].every(Number.isFinite)) {
        this.message = "Receiver coordinates must be finite.";
      } else {
        this.receiver = [x, y, z];
        this.message = "Read-only A4 readout recomputed.";
      }
      this.render();
    });
    this.root.querySelector<HTMLInputElement>("#a4-file")?.addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = parseContinuousFieldSnapshot(JSON.parse(await file.text()));
        this.uploadedSnapshot = parsed;
        this.uploadedName = file.name;
        this.fixtureId = "UPLOADED_SNAPSHOT";
        this.receiver = defaultReceiver(parsed);
        this.message = `Loaded ${file.name} under the strict A4 snapshot contract.`;
      } catch (caught) {
        this.message = String(caught);
      }
      this.render();
    });
    this.root.querySelector<HTMLButtonElement>("#a4-export")?.addEventListener("click", () => {
      const selected = this.projectionMode === "FIRST_REGISTERED_OWNER_COLUMN" && firstOwner
        ? firstOwner
        : full;
      const receipt = {
        schema: "VOXELLAB_A4_CONTINUOUS_FIELD_ACTION_BROWSER_RECEIPT_V1",
        bridgeCommit: APP_COMMIT,
        snapshot: {
          snapshotId: fixture.snapshot.snapshotId,
          sourceClass: fixture.snapshot.sourceClass,
          provenance: fixture.snapshot.provenance,
          dimensions: fixture.snapshot.dimensions,
          spacing: fixture.snapshot.spacing,
        },
        receiver: this.receiver,
        selectedProjection: this.projectionMode,
        selectedReadout: {
          w0: selected.w0,
          w1: selected.w1,
          w1Magnitude: selected.w1Magnitude,
          w2: selected.w2,
          traceClosureRelative: selected.traceClosureRelative,
          normalizedDeviatoricW2: selected.normalizedDeviatoricW2,
          multipoles: selected.multipoles,
          coverageFraction: selected.coverageFraction,
        },
        projectionComparison: {
          transparent: { w0: full.w0, w1: full.w1 },
          firstOwner: firstOwner ? { w0: firstOwner.w0, w1: firstOwner.w1 } : null,
          complementarySignedDiagnostic: complementary,
        },
        verdict: fixture.snapshot.sourceClass === "SYNTHETIC_ORACLE"
          ? "A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER"
          : "A4_FROZEN_SNAPSHOT_READOUT_RECORDED_NO_PHYSICAL_CLASSIFICATION",
        claimCeiling: "CONTINUOUS_FIELD_ACTION_READOUT_METHOD_ONLY_NOT_PHYSICAL_FORCE",
      };
      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `VOXELLAB_A4_${fixture.snapshot.snapshotId}_RECEIPT.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }
}
