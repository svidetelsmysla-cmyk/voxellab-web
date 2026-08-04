import { flattenScene, relativeResultDelta } from "./kernel";
import type { BodyResult, ComputeResult, RepresentationMode, SceneDocument, Vec3, WebGpuStatus } from "./types";

const SHADER = /* wgsl */ `
struct Element {
  position_amount: vec4<f32>,
  body_kv: vec4<f32>,
  local_offset: vec4<f32>,
};

struct ElementResult {
  force: vec4<f32>,
  torque: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> elements: array<Element>;
@group(0) @binding(1) var<storage, read_write> results: array<ElementResult>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p_index = gid.x;
  let count = arrayLength(&elements);
  if (p_index >= count) { return; }
  let p = elements[p_index];
  var force = vec3<f32>(0.0);
  var overlap = 0.0;
  var chunk_start = 0u;
  loop {
    if (chunk_start >= count) { break; }
    let chunk_end = min(chunk_start + 128u, count);
    var q_index = chunk_start;
    loop {
      if (q_index >= chunk_end) { break; }
      let q = elements[q_index];
      if (u32(q.body_kv.x) != u32(p.body_kv.x)) {
        let delta = p.position_amount.xyz - q.position_amount.xyz;
        let r2 = dot(delta, delta);
        if (r2 <= 1e-12) {
          overlap = 1.0;
        } else {
          let factor = p.body_kv.y * p.position_amount.w * q.position_amount.w / (r2 * sqrt(r2));
          force += factor * delta;
        }
      }
      q_index += 1u;
    }
    chunk_start += 128u;
  }
  results[p_index].force = vec4<f32>(force, overlap);
  results[p_index].torque = vec4<f32>(cross(p.local_offset.xyz, force), 0.0);
}
`;

function limitsRecord(limits: GPUSupportedLimits): Record<string, number> {
  return {
    maxBufferSize: Number(limits.maxBufferSize),
    maxStorageBufferBindingSize: Number(limits.maxStorageBufferBindingSize),
    maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
    maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
  };
}

export class WebGpuBackend {
  private pipeline: GPUComputePipeline | null = null;

  constructor(private readonly device: GPUDevice) {}

  private getPipeline(): GPUComputePipeline {
    if (!this.pipeline) {
      this.pipeline = this.device.createComputePipeline({
        layout: "auto",
        compute: { module: this.device.createShaderModule({ code: SHADER }), entryPoint: "main" },
      });
    }
    return this.pipeline;
  }

  async compute(scene: SceneDocument, overrides: Map<string, RepresentationMode>): Promise<ComputeResult> {
    const started = performance.now();
    const flat = flattenScene(scene, overrides);
    if (!flat.length) throw new Error("Scene contains no preview elements");
    const input = new Float32Array(flat.length * 12);
    flat.forEach((element, index) => {
      const offset = index * 12;
      input.set([...element.position, element.amount], offset);
      input.set([element.bodyIndex, element.k_v * scene.coefficient_c, 0, 0], offset + 4);
      input.set([...element.localOffset, 0], offset + 8);
    });
    const outputSize = flat.length * 8 * Float32Array.BYTES_PER_ELEMENT;
    const inputBuffer = this.device.createBuffer({
      size: input.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const outputBuffer = this.device.createBuffer({
      size: outputSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readBuffer = this.device.createBuffer({
      size: outputSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    this.device.queue.writeBuffer(inputBuffer, 0, input);
    const pipeline = this.getPipeline();
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(flat.length / 64));
    pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputSize);
    this.device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPUMapMode.READ);
    const output = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();
    inputBuffer.destroy();
    outputBuffer.destroy();
    readBuffer.destroy();
    const forces = scene.objects.map((): Vec3 => [0, 0, 0]);
    const torques = scene.objects.map((): Vec3 => [0, 0, 0]);
    flat.forEach((element, index) => {
      const base = index * 8;
      if ((output[base + 3] ?? 0) > 0) throw new Error("OVERLAP: WebGPU preview found coincident cross-body elements");
      for (let axis = 0; axis < 3; axis += 1) {
        const force = forces[element.bodyIndex];
        const torque = torques[element.bodyIndex];
        if (force && torque) {
          force[axis] = (force[axis] ?? 0) + (output[base + axis] ?? 0);
          torque[axis] = (torque[axis] ?? 0) + (output[base + 4 + axis] ?? 0);
        }
      }
    });
    const amount = scene.objects.reduce((sum, body) => sum + body.amount, 0);
    const bodies: BodyResult[] = scene.objects.map((body, index) => ({
      object_id: body.object_id,
      force: forces[index] ?? [0, 0, 0],
      torque: torques[index] ?? [0, 0, 0],
    }));
    return {
      backend: "WEBGPU",
      bodies,
      amount_in: amount,
      amount_out: amount,
      amount_residual: 0,
      compute_ms: performance.now() - started,
    };
  }
}

export async function initializeWebGpu(
  parityScene: SceneDocument,
  cpuReference: ComputeResult,
): Promise<{ status: WebGpuStatus; backend: WebGpuBackend | null }> {
  const status: WebGpuStatus = {
    secureContext: window.isSecureContext,
    navigatorGpu: Boolean(navigator.gpu),
    adapter: false,
    device: false,
    limits: {},
    parity: "NOT_AVAILABLE",
    detail: "CPU Worker fallback active",
  };
  if (!status.secureContext || !navigator.gpu) return { status, backend: null };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    status.adapter = Boolean(adapter);
    if (!adapter) return { status, backend: null };
    const device = await adapter.requestDevice();
    status.device = true;
    status.limits = limitsRecord(device.limits);
    const backend = new WebGpuBackend(device);
    status.parity = "PENDING";
    const gpuResult = await backend.compute(parityScene, new Map());
    const delta = relativeResultDelta(cpuReference, gpuResult);
    status.parity = delta <= 1e-5 ? "PASS" : "FAIL";
    status.detail = `Frozen scene relative delta ${delta.toExponential(3)}`;
    return { status, backend: status.parity === "PASS" ? backend : null };
  } catch (error) {
    status.detail = error instanceof Error ? error.message : String(error);
    status.parity = "FAIL";
    return { status, backend: null };
  }
}
