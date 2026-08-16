import { localPowerExponent } from "./scalingAnalysis";

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
  dVolume: number[];
  dAmount: number[];
  dPlus: number[];
  dMinus: number[];
  dRelief: number[];
  dL2: number[];
  hMeanAbs: number[];
  hRms: number[];
}

export function localScalingDimension(
  radii: readonly number[],
  measure: readonly number[],
): number[] {
  return localPowerExponent(radii, measure).map((value) => (
    Number.isFinite(value) ? -value : Number.NaN
  ));
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
    dVolume: localScalingDimension(rr, sampledVolume),
    dAmount: localScalingDimension(rr, amount),
    dPlus: localScalingDimension(rr, mPlus),
    dMinus: localScalingDimension(rr, mMinus),
    dRelief: localScalingDimension(rr, relief),
    dL2: localScalingDimension(rr, l2Relief),
    hMeanAbs: localPowerExponent(rr, meanAbsRelief),
    hRms: localPowerExponent(rr, rmsRelief),
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
