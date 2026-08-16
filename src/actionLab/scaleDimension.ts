export interface RadialMatterSample {
  radius: number;
  rho: number;
  rhoReference: number;
}

export interface ScaleDimensionProfile {
  radii: number[];
  sampledVolume: number[];
  amount: number[];
  mPlus: number[];
  mMinus: number[];
  relief: number[];
  balance: number[];
  l2Relief: number[];
  meanAbsRelief: number[];
  rmsRelief: number[];
  cancellation: number[];
  dVolume: number[];
  dAmount: number[];
  dPlus: number[];
  dMinus: number[];
  dRelief: number[];
  dL2: number[];
  hMeanAbs: number[];
  hRms: number[];
}

/** Windowed d ln(y) / d ln(r).  A local regression is less fragile than a
 * two-neighbour derivative on the frozen N16 scale-space packet. */
export function localLogSlope(
  radii: readonly number[],
  values: readonly number[],
  halfWindow = 3,
): number[] {
  const out = new Array<number>(radii.length).fill(Number.NaN);
  for (let i = 0; i < radii.length; i += 1) {
    const lo = Math.max(0, i - halfWindow);
    const hi = Math.min(radii.length, i + halfWindow + 1);
    const points: Array<[number, number]> = [];
    for (let j = lo; j < hi; j += 1) {
      const r = radii[j]!, value = values[j]!;
      if (r > 0 && value > 0 && Number.isFinite(r) && Number.isFinite(value)) {
        points.push([Math.log(r), Math.log(value)]);
      }
    }
    if (points.length < 3) continue;
    const mx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const my = points.reduce((s, p) => s + p[1], 0) / points.length;
    let covariance = 0, variance = 0;
    for (const [x, y] of points) {
      covariance += (x - mx) * (y - my);
      variance += (x - mx) ** 2;
    }
    if (variance > 0) out[i] = covariance / variance;
  }
  return out;
}

export function localScalingDimension(
  radii: readonly number[],
  measure: readonly number[],
): number[] {
  return localLogSlope(radii, measure);
}

export function buildScaleDimensionProfile(
  samples: readonly RadialMatterSample[],
  radii: readonly number[],
  voxelVolume: number,
): ScaleDimensionProfile {
  const sorted = [...samples].sort((a, b) => a.radius - b.radius);
  const sampledVolume: number[] = [];
  const amount: number[] = [];
  const mPlus: number[] = [];
  const mMinus: number[] = [];
  const relief: number[] = [];
  const balance: number[] = [];
  const l2Relief: number[] = [];
  const meanAbsRelief: number[] = [];
  const rmsRelief: number[] = [];
  const cancellation: number[] = [];

  let cursor = 0;
  let n = 0;
  let nAmount = 0;
  let plus = 0;
  let minus = 0;
  let l2 = 0;

  for (const R of radii) {
    while (cursor < sorted.length && sorted[cursor]!.radius <= R) {
      const sample = sorted[cursor]!;
      const delta = sample.rho - sample.rhoReference;
      n += 1;
      nAmount += sample.rho * voxelVolume;
      if (delta >= 0) plus += delta * voxelVolume;
      else minus += -delta * voxelVolume;
      l2 += delta * delta * voxelVolume;
      cursor += 1;
    }

    const volume = n * voxelVolume;
    const c = plus + minus;
    sampledVolume.push(volume || Number.NaN);
    amount.push(n ? nAmount : Number.NaN);
    mPlus.push(n ? plus : Number.NaN);
    mMinus.push(n ? minus : Number.NaN);
    relief.push(n ? c : Number.NaN);
    balance.push(n ? plus - minus : Number.NaN);
    l2Relief.push(n ? l2 : Number.NaN);
    meanAbsRelief.push(volume > 0 ? c / volume : Number.NaN);
    rmsRelief.push(volume > 0 ? Math.sqrt(l2 / volume) : Number.NaN);
    cancellation.push(c > 0 ? Math.abs(plus - minus) / c : 0);
  }

  const rr = [...radii];
  return {
    radii: rr,
    sampledVolume,
    amount,
    mPlus,
    mMinus,
    relief,
    balance,
    l2Relief,
    meanAbsRelief,
    rmsRelief,
    cancellation,
    dVolume: localScalingDimension(rr, sampledVolume),
    dAmount: localScalingDimension(rr, amount),
    dPlus: localScalingDimension(rr, mPlus),
    dMinus: localScalingDimension(rr, mMinus),
    dRelief: localScalingDimension(rr, relief),
    dL2: localScalingDimension(rr, l2Relief),
    hMeanAbs: localLogSlope(rr, meanAbsRelief).map((v) => -v),
    hRms: localLogSlope(rr, rmsRelief).map((v) => -v),
  };
}

export function outerStableMean(
  values: readonly number[],
  count = 6,
  absoluteCeiling = 20,
): number {
  const finite = values
    .filter((value) => Number.isFinite(value) && Math.abs(value) <= absoluteCeiling)
    .slice(-count);
  if (!finite.length) return Number.NaN;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}

export function compensationFraction(mPlus: number, mMinus: number): number {
  const scale = Math.max(mPlus + mMinus, 1e-30);
  return Math.abs(mPlus - mMinus) / scale;
}

export function minimumFinite(values: readonly number[]): { value: number; index: number } | null {
  let best = Infinity;
  let index = -1;
  values.forEach((value, i) => {
    if (Number.isFinite(value) && value < best) { best = value; index = i; }
  });
  return index >= 0 ? { value: best, index } : null;
}
