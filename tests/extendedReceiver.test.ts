import { describe, expect, it } from "vitest";
import {
  analyticExtendedReceiver,
  cubatureExtendedReceiver,
  extendedReceiverParity,
  localExtendedReceiverChannels,
  receiverAmount,
  shellIntegratedExtendedReceiver,
  sourceCoefficient,
  type ExtendedReceiverModel,
} from "../src/actionLab/extendedReceiver";

const base: ExtendedReceiverModel = {
  sourceRadius: 1,
  receiverRadius: 0.7,
  separation: 1.9,
  backgroundIntensityPerSteradian: 1,
  sourceToMatchedRatio: 1,
  receiverDensity: 1,
};

describe("Action Transport Lab A1 extended receiver", () => {
  it("reduces each non-overlap 1/r2 branch to receiver amount over centre separation squared", () => {
    for (const receiverRadius of [0.2, 0.7, 1.2]) {
      for (const gap of [0, 0.05, 0.5, 3]) {
        const model = {
          ...base,
          receiverRadius,
          separation: base.sourceRadius + receiverRadius + gap,
        };
        const analytic = analyticExtendedReceiver(model);
        const expected = sourceCoefficient(model) * receiverAmount(model) / model.separation ** 2;
        expect(analytic.directW1[0]).toBeCloseTo(expected, 13);
        expect(analytic.backgroundW1[0]).toBeCloseTo(-expected, 13);
        expect(analytic.netW1[0]).toBeCloseTo(0, 13);
      }
    }
  });

  it("matches the analytic directional oracle with curved-shell integration", () => {
    for (const gap of [0, 0.01, 0.2, 1, 4]) {
      const model = { ...base, separation: base.sourceRadius + base.receiverRadius + gap };
      const analytic = analyticExtendedReceiver(model);
      const shell = shellIntegratedExtendedReceiver(model);
      expect(shell.directW1[0]).toBeCloseTo(analytic.directW1[0], 11);
      expect(shell.backgroundW1[0]).toBeCloseTo(analytic.backgroundW1[0], 11);
      expect(shell.netW1[0]).toBeCloseTo(0, 11);
    }
  });

  it("matches scalar and directional receiver integrals with 3D cubature at contact and separation", () => {
    for (const gap of [0, 0.2, 2]) {
      const model = { ...base, separation: base.sourceRadius + base.receiverRadius + gap };
      const parity = extendedReceiverParity(model);
      expect(parity.cubatureDirectRelativeError).toBeLessThan(1e-5);
      expect(parity.cubatureBackgroundRelativeError).toBeLessThan(1e-5);
      expect(parity.cubatureBodyW0RelativeError).toBeLessThan(1e-4);
      expect(parity.cubatureDeficitRelativeError).toBeLessThan(1e-4);
      expect(parity.normalizedTorque).toBeLessThan(1e-5);
    }
  });

  it("cancels pointwise at kappa one before any centre-of-mass reduction", () => {
    const points = [
      [base.separation - 0.6, 0, 0],
      [base.separation, 0.5, 0],
      [base.separation + 0.3, -0.2, 0.1],
    ] as const;
    for (const point of points) {
      const channels = localExtendedReceiverChannels(point, base);
      expect(channels.net[0]).toBeCloseTo(0, 13);
      expect(channels.net[1]).toBeCloseTo(0, 13);
      expect(channels.net[2]).toBeCloseTo(0, 13);
    }
  });

  it("keeps one net sign at every separation when kappa differs from one", () => {
    for (const ratio of [0.7, 1.3]) {
      for (const gap of [0, 0.1, 1, 5]) {
        const model = {
          ...base,
          sourceToMatchedRatio: ratio,
          separation: base.sourceRadius + base.receiverRadius + gap,
        };
        const result = shellIntegratedExtendedReceiver(model);
        expect(Math.sign(result.netW1[0])).toBe(ratio < 1 ? -1 : 1);
      }
    }
  });

  it("retains a near-field W0 distinction although matched W1 cancels", () => {
    const contact = shellIntegratedExtendedReceiver({
      ...base,
      separation: base.sourceRadius + base.receiverRadius,
    });
    const far = shellIntegratedExtendedReceiver({
      ...base,
      separation: base.sourceRadius + base.receiverRadius + 20,
    });
    expect(Math.abs(contact.backgroundStraightDeficit - contact.bodyW0)).toBeGreaterThan(1e-3);
    expect(Math.abs(contact.netW1[0])).toBeLessThan(1e-11);
    expect(Math.abs(far.backgroundStraightDeficit - far.bodyW0)).toBeLessThan(
      Math.abs(contact.backgroundStraightDeficit - contact.bodyW0),
    );
  });

  it("keeps integrated torque at zero for the symmetric spherical receiver", () => {
    const result = cubatureExtendedReceiver(base);
    const torque = Math.hypot(...result.netTorque);
    const scale = Math.abs(analyticExtendedReceiver(base).directW1[0]) * base.receiverRadius;
    expect(torque / scale).toBeLessThan(1e-5);
  });
});
