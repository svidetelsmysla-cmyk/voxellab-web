import "./styles.css";
import "./actionTallyAudit.css";
import { SceneLabApp } from "./app/SceneLabApp";
import { mountActionTallyAuditPanel } from "./diagnostics/actionTallyAuditPanel";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");
new SceneLabApp(root);
void mountActionTallyAuditPanel();

const topbar = document.querySelector<HTMLElement>(".topbar-meta");
if (topbar) {
  const actionLabLink = document.createElement("a");
  actionLabLink.href = `${import.meta.env.BASE_URL}action-lab/`;
  actionLabLink.textContent = "Action / Source Lab · N54 ↗";
  actionLabLink.dataset.testid = "action-lab-link";
  topbar.prepend(actionLabLink);
}
