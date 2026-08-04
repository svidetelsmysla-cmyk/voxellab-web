export const PERFORMANCE_TARGETS = [
  { id: "B1", requirement: "2 bodies × ≥512 compute elements", configured: 1024 },
  { id: "B2", requirement: "≥20,000 visible packed elements", configured: 20000 },
  { id: "B3", requirement: "≥180 layered KOU bodies", configured: 180 },
  { id: "B4", requirement: "≥50 simultaneously movable bodies", configured: 50 },
  { id: "B5", requirement: "≥16,384 first-hit directions", configured: 16384 },
] as const;

export class FrameMeter {
  private frames = 0; private steps = 0; private started = performance.now(); private compute = 0; private render = 0;
  record(stepCount: number, computeMs: number, renderMs: number) { this.frames += 1; this.steps += stepCount; this.compute += computeMs; this.render += renderMs; }
  snapshot() { const elapsed = Math.max(1, performance.now() - this.started); return { fps: this.frames * 1000 / elapsed, steps_per_second: this.steps * 1000 / elapsed, mean_compute_ms: this.compute / Math.max(1, this.frames), mean_render_ms: this.render / Math.max(1, this.frames) }; }
  reset() { this.frames = 0; this.steps = 0; this.started = performance.now(); this.compute = 0; this.render = 0; }
}

