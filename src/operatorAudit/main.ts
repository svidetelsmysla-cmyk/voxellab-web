import "./styles.css";
import { OperatorAuditApp } from "./App";

const root = document.querySelector<HTMLElement>("#operator-audit-app");
if (!root) throw new Error("Missing #operator-audit-app root");
new OperatorAuditApp(root);
