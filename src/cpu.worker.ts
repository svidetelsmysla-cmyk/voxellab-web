/// <reference lib="webworker" />

import { computeDirect } from "./kernel";
import type { RepresentationMode, SceneDocument } from "./types";

interface RequestMessage {
  id: number;
  scene: SceneDocument;
  overrides: [string, RepresentationMode][];
}

self.onmessage = (event: MessageEvent<RequestMessage>) => {
  const { id, scene, overrides } = event.data;
  try {
    const result = computeDirect(scene, new Map(overrides));
    result.backend = "CPU_WORKER";
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

export {};
