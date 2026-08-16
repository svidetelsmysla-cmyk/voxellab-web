export interface PowerFit {
  exponent: number;
  prefactor: number;
  r2: number;
  count: number;
}

export interface R15FoldPoint {
  q: number;
  deltaQ: number;
  rInner: number;
  rOuter: number;
  separation: number;
  bGap: number;
}

export const R15_Q_CRIT = 2.1283909617509185;
export const R15_R_CRIT = 0.48586882717015817;

const RHO_BG = 0.30;
const R15_S = 0.50;
const R15_A = 0.72;

export function localPowerExponent(x: readonly number[], y: readonly number[]): number[] {
  if (x.length !== y.length) throw new Error("x/y length mismatch");
  const out = new Array<number>(x.length).fill(Number.NaN);
  for (let i = 1; i + 1 < x.length; i += 1) {
    const x0 = x[i - 1]!, x1 = x[i + 1]!;
    const y0 = Math.abs(y[i - 1]!), y1 = Math.abs(y[i + 1]!);
    if (!(x0 > 0 && x1 > x0 && y0 > 1e-30 && y1 > 1e-30)) continue;
    out[i] = -(Math.log(y1) - Math.log(y0)) / (Math.log(x1) - Math.log(x0));
  }
  return out;
}

export function fitPowerLaw(x: readonly number[], y: readonly number[]): PowerFit {
  const pairs = x.map((value, i) => [value, Math.abs(y[i] ?? Number.NaN)] as const)
    .filter(([xx, yy]) => xx > 0 && yy > 0 && Number.isFinite(xx) && Number.isFinite(yy));
  if (pairs.length < 3) return { exponent: Number.NaN, prefactor: Number.NaN, r2: Number.NaN, count: pairs.length };
  const lx = pairs.map(([xx]) => Math.log(xx));
  const ly = pairs.map(([, yy]) => Math.log(yy));
  const mx = lx.reduce((a, b) => a + b, 0) / lx.length;
  const my = ly.reduce((a, b) => a + b, 0) / ly.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < lx.length; i += 1) {
    const dx = lx[i]! - mx, dy = ly[i]! - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const exponent = sxy / Math.max(sxx, 1e-30);
  const intercept = my - exponent * mx;
  const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 1;
  return { exponent, prefactor: Math.exp(intercept), r2, count: pairs.length };
}

export function hierarchyDimension(countRatio: number, lengthRatio: number): number {
  if (!(countRatio > 0) || !(lengthRatio > 1)) return Number.NaN;
  return Math.log(countRatio) / Math.log(lengthRatio);
}

/**
 * Per-log-shell scaling of a directional solid-angle contribution.
 * If the number of effective contributors inside scale R grows as R^D,
 * one elementary geometric footprint falls as R^-2, and a dimensionless
 * anisotropy/quality factor scales as R^eta, then contribution per log scale
 * is proportional to R^(D - 2 + eta).
 */
export function shellActionExponent(dimension: number, qualityExponent = 0): number {
  return dimension - 2 + qualityExponent;
}

export function r15Rho(r: number, q: number): number {
  const sv = R15_S * q;
  const av = R15_A / (q * q);
  const r2 = r * r;
  return RHO_BG
    + R15_A * Math.exp(-r2 / (2 * R15_S * R15_S))
    - av * Math.exp(-r2 / (2 * sv * sv));
}

export function r15B(r: number, q: number): number {
  return r / (1 - r15Rho(r, q));
}

export function r15DB(r: number, q: number): number {
  const sv = R15_S * q;
  const av = R15_A / (q * q);
  const c = R15_A * Math.exp(-(r * r) / (2 * R15_S * R15_S));
  const v = av * Math.exp(-(r * r) / (2 * sv * sv));
  const rho = RHO_BG + c - v;
  const rhoPrime = -c * r / (R15_S * R15_S) + v * r / (sv * sv);
  const d = 1 - rho;
  return (d + r * rhoPrime) / (d * d);
}

function bisectRoot(fn: (x: number) => number, lo: number, hi: number, iterations = 70): number {
  let flo = fn(lo), fhi = fn(hi);
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) throw new Error("root is not bracketed");
  for (let i = 0; i < iterations; i += 1) {
    const mid = 0.5 * (lo + hi);
    const fm = fn(mid);
    if (flo * fm <= 0) { hi = mid; fhi = fm; }
    else { lo = mid; flo = fm; }
  }
  return 0.5 * (lo + hi);
}

export function r15Extrema(q: number): [number, number] | null {
  if (!(q > R15_Q_CRIT)) return null;
  const roots: number[] = [];
  const n = 4000, rMax = 3.5;
  let r0 = 1e-7, f0 = r15DB(r0, q);
  for (let i = 1; i <= n; i += 1) {
    const r1 = rMax * i / n;
    const f1 = r15DB(r1, q);
    if (Number.isFinite(f0) && Number.isFinite(f1) && f0 * f1 < 0) roots.push(bisectRoot((r) => r15DB(r, q), r0, r1));
    r0 = r1; f0 = f1;
    if (roots.length >= 2) break;
  }
  return roots.length >= 2 ? [roots[0]!, roots[1]!] : null;
}

export function r15FoldScaling(samples = 48, maxDeltaQ = 0.45): R15FoldPoint[] {
  const rows: R15FoldPoint[] = [];
  const lo = Math.log(1e-6), hi = Math.log(maxDeltaQ);
  for (let i = 0; i < samples; i += 1) {
    const deltaQ = Math.exp(lo + (hi - lo) * i / Math.max(1, samples - 1));
    const q = R15_Q_CRIT + deltaQ;
    const roots = r15Extrema(q);
    if (!roots) continue;
    const [rInner, rOuter] = roots;
    rows.push({
      q,
      deltaQ,
      rInner,
      rOuter,
      separation: rOuter - rInner,
      bGap: Math.abs(r15B(rInner, q) - r15B(rOuter, q)),
    });
  }
  return rows;
}
