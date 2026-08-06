import "./styles.css";
import { ActionTransportApp } from "./App";

const root = document.querySelector<HTMLElement>("#action-app");
if (!root) throw new Error("Missing #action-app root");
new ActionTransportApp(root);

const links = document.querySelector<HTMLElement>(".topbar-links");
if (links) {
  const operatorAuditLink = document.createElement("a");
  operatorAuditLink.href = `${import.meta.env.BASE_URL}operator-audit/`;
  operatorAuditLink.textContent = "Operator Audit A1 ↗";
  operatorAuditLink.dataset.testid = "operator-audit-link";
  links.append(operatorAuditLink);
}
