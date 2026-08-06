import { generateD0SMicrobodies, type D0SLevelId } from "./d0sMicrobodyParity";
import { sphereVolume, vectorNorm, type FieldSample, type Vec3 } from "./math";

export type CavityChannel =
  | "RESIDUAL_W1"
  | "DEFICIT_W0"
  | "BODY_W0"
  | "BACKGROUND_W0"
  | "BASELINE_W0";

export interface CavityFixture {
  reservoirRadius: number;
  bodyRadius: number;
  cavityRadius: number;
  backgroundDensity: number;
  refinement: D0SLevelId;
}

export interface CavityParticle {
  position: Vec3;
  amount: number;
  active: boolean;
}

export interface CavityLedger {
  baselineAmount: number;
  activeBackgroundAmount: number;
  removedBackgroundAmount: number;
  bodyAmount: number;
  totalCurrentAmount: number;
  closureResidual: number;
  particleCount: number;
  activeParticleCount: number;
}

export interface CavityPointSample {
  baseline: FieldSample;
  background: FieldSample;
  deficit: FieldSample;
  body: FieldSample;
  residual: FieldSample;
}

const LEVELS = {
  N48: { id: "N48", count: 48, shellCount: 3 },
  N192: { id: "N192", count: 192, shellCount: 5 },
  N768: { id: "N768", count: 768, shellCount: 8 },
  N3072: { id: "N3072", count: 3072, shellCount: 12 },
} as const;

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: Vec3, factor: number): Vec3 {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function samplePointBodies(probe: Vec3, bodies: readonly { position: Vec3; amount: number }[]): FieldSample {
  let w0 = 0;
  let w1: Vec3 = [0, 0, 0];
  for (const body of bodies) {
    const delta = subtract(body.position, probe);
    const distance = Math.max(1e-4, vectorNorm(delta));
    w0 += body.amount / distance ** 2;
    w1 = add(w1, scale(delta, body.amount / distance ** 3));
  }
  return { w0, w1, w1Magnitude: vectorNorm(w1) };
}

function sampleUniformBody(probe: Vec3, radius: number, amount: number): FieldSample {
  const distance = vectorNorm(probe);
  if (distance < 1e-12) return { w0: 3 * amount / radius ** 2, w1: [0, 0, 0], w1Magnitude: 0 };
  if (distance >= radius) {
    const magnitude = amount / distance ** 2;
    const direction = scale(probe, -1 / distance);
    return { w0: amount / distance ** 2, w1: scale(direction, magnitude), w1Magnitude: magnitude };
  }
  const magnitude = amount * distance / radius ** 3;
  const direction = scale(probe, -1 / distance);
  return {
    w0: 3 * amount / radius ** 2 - amount * distance ** 2 / radius ** 4,
    w1: scale(direction, magnitude),
    w1Magnitude: magnitude,
  };
}

export function buildCavityFixture(fixture: CavityFixture): {
  particles: CavityParticle[];
  ledger: CavityLedger;
} {
  if (!(fixture.reservoirRadius > fixture.cavityRadius && fixture.cavityRadius > fixture.bodyRadius && fixture.bodyRadius > 0)) {
    throw new Error("C1 requires reservoirRadius > cavityRadius > bodyRadius > 0");
  }
  const definition = LEVELS[fixture.refinement];
  const generated = generateD0SMicrobodies(
    { radius: fixture.reservoirRadius, density: fixture.backgroundDensity },
    definition,
  );
  const particles = generated.bodies.map((body) => ({
    position: body.position,
    amount: body.amount,
    active: vectorNorm(body.position) >= fixture.cavityRadius,
  }));
  const baselineAmount = particles.reduce((sum, p) => sum + p.amount, 0);
  const activeBackgroundAmount = particles.filter((p) => p.active).reduce((sum, p) => sum + p.amount, 0);
  const removedBackgroundAmount = baselineAmount - activeBackgroundAmount;
  const bodyAmount = removedBackgroundAmount;
  const totalCurrentAmount = activeBackgroundAmount + bodyAmount;
  return {
    particles,
    ledger: {
      baselineAmount,
      activeBackgroundAmount,
      removedBackgroundAmount,
      bodyAmount,
      totalCurrentAmount,
      closureResidual: totalCurrentAmount - baselineAmount,
      particleCount: particles.length,
      activeParticleCount: particles.filter((p) => p.active).length,
    },
  };
}

export function sampleCavityPoint(
  probe: Vec3,
  fixture: CavityFixture,
  particles: readonly CavityParticle[],
  ledger: CavityLedger,
): CavityPointSample {
  const baselineBodies = particles.map(({ position, amount }) => ({ position, amount }));
  const activeBodies = particles.filter((p) => p.active).map(({ position, amount }) => ({ position, amount }));
  const removedBodies = particles.filter((p) => !p.active).map(({ position, amount }) => ({ position, amount }));
  const baseline = samplePointBodies(probe, baselineBodies);
  const background = samplePointBodies(probe, activeBodies);
  const deficit = samplePointBodies(probe, removedBodies);
  const body = sampleUniformBody(probe, fixture.bodyRadius, ledger.bodyAmount);
  const residualVector = subtract(body.w1, deficit.w1);
  return {
    baseline,
    background,
    deficit,
    body,
    residual: {
      w0: body.w0 + background.w0 - baseline.w0,
      w1: residualVector,
      w1Magnitude: vectorNorm(residualVector),
    },
  };
}

export function radialCavityProfile(fixture: CavityFixture, bins = 24): {
  radius: number;
  baselineDensity: number;
  currentDensity: number;
  deficitFraction: number;
}[] {
  const { particles } = buildCavityFixture(fixture);
  const rows = Array.from({ length: bins }, (_, index) => ({
    radius: fixture.reservoirRadius * (index + 0.5) / bins,
    baselineCount: 0,
    currentCount: 0,
  }));
  for (const particle of particles) {
    const r = vectorNorm(particle.position);
    const index = Math.min(bins - 1, Math.floor(r / fixture.reservoirRadius * bins));
    rows[index]!.baselineCount += 1;
    if (particle.active) rows[index]!.currentCount += 1;
  }
  return rows.map((row, index) => {
    const r0 = fixture.reservoirRadius * index / bins;
    const r1 = fixture.reservoirRadius * (index + 1) / bins;
    const shellVolume = (4 / 3) * Math.PI * (r1 ** 3 - r0 ** 3);
    const baselineDensity = row.baselineCount / shellVolume;
    const currentDensity = row.currentCount / shellVolume;
    return {
      radius: row.radius,
      baselineDensity,
      currentDensity,
      deficitFraction: baselineDensity > 0 ? (baselineDensity - currentDensity) / baselineDensity : 0,
    };
  });
}

export function cavitySummary(fixture: CavityFixture): {
  cavityVolumeFraction: number;
  bodyDensityRatio: number;
} {
  const cavityVolume = (4 / 3) * Math.PI * fixture.cavityRadius ** 3;
  const reservoirVolume = sphereVolume({ radius: fixture.reservoirRadius, density: 1 });
  const bodyVolume = sphereVolume({ radius: fixture.bodyRadius, density: 1 });
  return {
    cavityVolumeFraction: cavityVolume / reservoirVolume,
    bodyDensityRatio: cavityVolume / bodyVolume,
  };
}
