import "./styles.css";
import "./candidateFamilyPanel.css";
import { OperatorAuditApp } from "./App";
import { mountCandidateFamilyPanel } from "./candidateFamilyPanel";

const root = document.querySelector<HTMLElement>("#operator-audit-app");
if (!root) throw new Error("Missing #operator-audit-app root");
new OperatorAuditApp(root);
void mountCandidateFamilyPanel();
