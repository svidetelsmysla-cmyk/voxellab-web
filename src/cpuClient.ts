import type { ComputeResult, RepresentationMode, SceneDocument } from "./types";

interface WorkerReply {
  id: number;
  result?: ComputeResult;
  error?: string;
}

export class CpuWorkerClient {
  private readonly worker = new Worker(new URL("./cpu.worker.ts", import.meta.url), { type: "module" });
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: ComputeResult) => void; reject: (reason: Error) => void }>();

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const item = this.pending.get(event.data.id);
      if (!item) return;
      this.pending.delete(event.data.id);
      if (event.data.error) item.reject(new Error(event.data.error));
      else if (event.data.result) item.resolve(event.data.result);
      else item.reject(new Error("CPU Worker returned an empty result"));
    };
    this.worker.onerror = (event) => {
      for (const item of this.pending.values()) item.reject(new Error(event.message));
      this.pending.clear();
    };
  }

  compute(scene: SceneDocument, overrides: Map<string, RepresentationMode>): Promise<ComputeResult> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, scene, overrides: [...overrides.entries()] });
    });
  }

  close(): void {
    this.worker.terminate();
  }
}
