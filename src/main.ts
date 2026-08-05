import "./styles.css";
import "./actionTallyAudit.css";
import { SceneLabApp } from "./app/SceneLabApp";
import { mountActionTallyAuditPanel } from "./diagnostics/actionTallyAuditPanel";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");
new SceneLabApp(root);
void mountActionTallyAuditPanel();
