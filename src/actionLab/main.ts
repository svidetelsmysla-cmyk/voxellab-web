import "./styles.css";
import { ActionTransportApp } from "./App";

const root = document.querySelector<HTMLElement>("#action-app");
if (!root) throw new Error("Missing #action-app root");
new ActionTransportApp(root);
