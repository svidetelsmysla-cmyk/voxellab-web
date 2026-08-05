import "./styles.css";
import "./stylesA02.css";
import { ActionTransportAppA02 } from "./AppA02";

const root = document.querySelector<HTMLElement>("#action-app");
if (!root) throw new Error("Missing #action-app root");
new ActionTransportAppA02(root);
