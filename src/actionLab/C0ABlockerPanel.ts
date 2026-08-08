const APP_COMMIT = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

function template(): string {
  return `
    <section class="card" data-testid="c0a-blocker-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">R14 · C0A UNIFORM BACKGROUND REPAIR</p>
          <h2>C1 replay blocked: C0 is not refinement-stable yet</h2>
          <p>
            The inherited N=96 cavity result is not promoted. R14 repaired the spherical sampler
            and closed the B0 continuum oracle, but the preregistered N/iteration refinement gates
            do not yet establish a trustworthy uniform C0 baseline.
          </p>
        </div>
        <span class="audit-badge">C0A BLOCKED</span>
      </div>

      <div class="c01-conclusion" data-testid="c0a-verdict">
        <strong>Primary verdict</strong>
        <p><code>C0A_NUMERICAL_CONVERGENCE_OR_SAMPLER_BLOCKER</code></p>
      </div>

      <div class="c01-grid">
        <article class="c01-metrics">
          <div class="section-head"><div><p class="eyebrow">GATES</p><h2>What passed / failed</h2></div></div>
          <dl>
            <div><dt>Independent sampler</dt><dd>PASS 5/5</dd></div>
            <div><dt>B0 continuum oracle</dt><dd>PASS · residual 0</dd></div>
            <div><dt>N=768 → 1536 stability</dt><dd>FAIL</dd></div>
            <div><dt>N=384 · 320 → 640 iteration stability</dt><dd>FAIL</dd></div>
            <div><dt>C1 replay</dt><dd>BLOCKED</dd></div>
          </dl>
        </article>
        <article class="c01-metrics">
          <div class="section-head"><div><p class="eyebrow">CLAIM CEILING</p><h2>No rescue physics added</h2></div></div>
          <dl>
            <div><dt>Upor / pressure / contact</dt><dd>NOT ADDED</dd></div>
            <div><dt>Physical time</dt><dd>NOT CLAIMED</dd></div>
            <div><dt>Scale / validation</dt><dd>NOT CLAIMED</dd></div>
            <div><dt>Canon / merge</dt><dd>NO</dd></div>
          </dl>
        </article>
      </div>

      <p class="c01-note">
        The older R13 generated-cavity scene remains historical numerical evidence only.
        R14 does not display it as a current generated-cavity claim because the repaired C0 gate did not open.
      </p>
      <code class="closure-commit">commit ${APP_COMMIT.slice(0, 12)}</code>
    </section>
  `;
}

export class C0ABlockerPanel {
  constructor(private readonly root: HTMLElement) {
    root.innerHTML = template();
  }
}
