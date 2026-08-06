import "./styles.css";
import "./actionTallyAudit.css";
import { SceneLabApp } from "./app/SceneLabApp";
import { mountActionTallyAuditPanel } from "./diagnostics/actionTallyAuditPanel";
import { mountRelationalTimeUiRepair } from "./diagnostics/relationalTimeUiRepair";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");
new SceneLabApp(root);
mountRelationalTimeUiRepair();
void mountActionTallyAuditPanel();

const topbar = document.querySelector<HTMLElement>(".topbar-meta");
if (topbar) {
  const operatorAuditLink = document.createElement("a");
  operatorAuditLink.href = `${import.meta.env.BASE_URL}operator-audit/`;
  operatorAuditLink.textContent = "Operator Audit A1 ↗";
  operatorAuditLink.dataset.testid = "operator-audit-link";
  topbar.prepend(operatorAuditLink);

  const actionLabLink = document.createElement("a");
  actionLabLink.href = `${import.meta.env.BASE_URL}action-lab/`;
  actionLabLink.textContent = "Action Transport Lab A0 ↗";
  actionLabLink.dataset.testid = "action-lab-link";
  topbar.prepend(actionLabLink);
}
