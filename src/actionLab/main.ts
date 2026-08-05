import "./styles.css";
import "./stylesA02.css";
import "./closurePanel.css";
import "./extendedReceiver.css";
import "./overlapGeometry.css";
import { ActionTransportAppA02 } from "./AppA02";
import { installA02DisplaySemanticsRepair } from "./a02DisplaySemanticsRepair";
import { OneBodyClosurePanel } from "./ClosurePanel";
import { ExtendedReceiverPanel } from "./ExtendedReceiverPanel";
import { OverlapGeometryPanel } from "./OverlapPanel";

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

// The original HTML range step (0.01) rounded the analytic preset
// sqrt(3)-1 = 0.7320508... to 0.73. This display-only repair keeps the
// operator and oracle unchanged while allowing the browser control to retain 0.732.
const overlapSeparation = overlapRoot.querySelector<HTMLInputElement>("#a2-separation");
if (overlapSeparation) overlapSeparation.step = "0.001";
