import "./styles.css";
import { SceneLabApp } from "./app/SceneLabApp";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");
new SceneLabApp(root);
