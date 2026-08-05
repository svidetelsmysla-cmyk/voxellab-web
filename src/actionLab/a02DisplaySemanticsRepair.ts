import { ActionTransportAppA02 } from "./AppA02";
import { analyticSphereOutside, normalizedDisplayValue, type SphereModel, type Vec3 } from "./math";
import { analyticIsotropicSphereBackground, type IsotropicBackgroundModel } from "./background";

type DisplayChannel = "BODY_W0" | "BODY_W1" | "BG_DEFICIT" | "BG_STRAIGHT" | "BG_RESULTANT";

interface RuntimeState {
  channel: DisplayChannel;
  sphere: SphereModel;
  background: IsotropicBackgroundModel;
  root: HTMLElement;
}

interface RuntimePrototype {
  displayValue(this: RuntimeState, point: Vec3): number;
  renderFieldMap(this: RuntimeState): void;
}

/**
 * A0.2 preregistration used the correct full-sky formula Omega_body/(4*pi),
 * but the first UI draft accidentally normalized the scalar cap as if the
 * surface limit were one quarter of the sky. An exterior receiver approaching
 * a sphere sees a hemisphere, so the scalar deficit limit is one half.
 *
 * The raw ledger and all numerical routes were already correct. This repair is
 * deliberately isolated to display normalization and labels.
 */
export function installA02DisplaySemanticsRepair(): void {
  const prototype = ActionTransportAppA02.prototype as unknown as RuntimePrototype;
  const originalRenderFieldMap = prototype.renderFieldMap;

  prototype.displayValue = function displayValue(point: Vec3): number {
    if (this.channel === "BODY_W0" || this.channel === "BODY_W1") {
      const body = analyticSphereOutside(point, this.sphere);
      return normalizedDisplayValue(body, this.sphere, this.channel === "BODY_W0" ? "W0" : "W1");
    }
    const ledger = analyticIsotropicSphereBackground(point, this.sphere, this.background);
    if (this.channel === "BG_DEFICIT") return ledger.deficitFraction / 0.5;
    if (this.channel === "BG_STRAIGHT") return (ledger.straightFraction - 0.5) / 0.5;
    return ledger.residualMagnitude / (Math.PI * this.background.intensityPerSteradian);
  };

  prototype.renderFieldMap = function renderFieldMap(): void {
    originalRenderFieldMap.call(this);
    if (this.channel === "BG_DEFICIT") {
      const right = this.root.querySelector<HTMLElement>("#legend-right");
      if (right) right.textContent = "surface limit 0.50";
    }
    if (this.channel === "BG_STRAIGHT") {
      const left = this.root.querySelector<HTMLElement>("#legend-left");
      if (left) left.textContent = "surface limit 0.50";
    }
  };
}
