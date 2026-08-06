import "./styles.css";
import "./stylesA02.css";
import "./closurePanel.css";
import "./extendedReceiver.css";
import "./overlapGeometry.css";
import "./freeBoundaryBounds.css";
import "./d0sParity.css";
import "./d0mDynamics.css";
import { ActionTransportAppA02 } from "./AppA02";
import { installA02DisplaySemanticsRepair } from "./a02DisplaySemanticsRepair";
import { OneBodyClosurePanel } from "./ClosurePanel";
import { ExtendedReceiverPanel } from "./ExtendedReceiverPanel";
import { OverlapGeometryPanel } from "./OverlapPanel";
import { FreeBoundaryBoundsPanel } from "./FreeBoundaryBoundsPanel";
import { D0SParityPanel } from "./D0SParityPanel";
import { D0MDynamicsPanel } from "./D0MDynamicsPanel";

installA02DisplaySemanticsRepair();

const root = document.querySelector<HTMLElement>("#action-app");
if (!root) throw new Error("Missing #action-app root");
new ActionTransportAppA02(root);

const closureRoot = document.createElement("div");
closureRoot.id = "closure-a03-root";
root.append(closureRoot);
new OneBodyClosurePanel(closureRoot);

const extendedReceiverRoot = document.createElement("div");
extendedReceiverRoot.id = "extended-a1-root";
root.append(extendedReceiverRoot);
new ExtendedReceiverPanel(extendedReceiverRoot);

const overlapRoot = document.createElement("div");
overlapRoot.id = "overlap-a2-root";
root.append(overlapRoot);
new OverlapGeometryPanel(overlapRoot);

const overlapSeparation = overlapRoot.querySelector<HTMLInputElement>("#a2-separation");
if (overlapSeparation) overlapSeparation.step = "0.001";

const freeBoundaryRoot = document.createElement("div");
freeBoundaryRoot.id = "free-boundary-a2b-root";
root.append(freeBoundaryRoot);
new FreeBoundaryBoundsPanel(freeBoundaryRoot);

const d0sRoot = document.createElement("div");
d0sRoot.id = "d0s-static-microbody-parity-root";
root.append(d0sRoot);
new D0SParityPanel(d0sRoot);

const d0mRoot = document.createElement("div");
d0mRoot.id = "d0m-isolated-microbody-dynamics-root";
root.append(d0mRoot);
new D0MDynamicsPanel(d0mRoot);
