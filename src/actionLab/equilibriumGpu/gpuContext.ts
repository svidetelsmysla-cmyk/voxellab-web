import { classifyRegimeShader } from "./shaders/classifyRegime.wgsl";
import type { PlaneDefinition, PlaneResult, RegimeThresholds, VolumeFrame } from "./types";

export interface WebGpuRunReceipt {
  result: PlaneResult;
  adapter: { vendor: string; architecture: string; device: string; description: string };
}

export function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.gpu);
}

interface CachedGpuState {
  adapter: GPUAdapter;
  device: GPUDevice;
  pipeline: GPUComputePipeline;
}

let cachedGpuState: Promise<CachedGpuState> | undefined;

async function createGpuState(): Promise<CachedGpuState> {
  if (!navigator.gpu) throw new Error("WEBGPU_ADAPTER_UNAVAILABLE");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("WEBGPU_ADAPTER_UNAVAILABLE");
  const device = await adapter.requestDevice();
  const module = device.createShaderModule({ label: "V14 equilibrium classifier", code: classifyRegimeShader });
  const compilation = await module.getCompilationInfo();
  const errors = compilation.messages.filter((message) => message.type === "error");
  if (errors.length) throw new Error(`WGSL_COMPILE_FAILED: ${errors.map((e) => `${e.lineNum}:${e.message}`).join(" | ")}`);
  const pipeline = await device.createComputePipelineAsync({ label: "Equilibrium plane classifier", layout: "auto", compute: { module, entryPoint: "main" } });
  return { adapter, device, pipeline };
}

function createBuffer(device: GPUDevice, label: string, data: ArrayBufferView, usage: GPUBufferUsageFlags) {
  const buffer = device.createBuffer({ label, size: Math.ceil(data.byteLength / 4) * 4, usage, mappedAtCreation: true });
  const destination = new Uint8Array(buffer.getMappedRange());
  destination.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  buffer.unmap();
  return buffer;
}

export async function samplePlaneWebGpu(
  frame: VolumeFrame,
  plane: PlaneDefinition,
  width: number,
  height: number,
  thresholds: RegimeThresholds,
): Promise<WebGpuRunReceipt> {
  const { adapter, device, pipeline } = await (cachedGpuState ??= createGpuState());
  const started = performance.now();
  const voxelCount = frame.response.length / 3;
  const packedVolume = new Float32Array(voxelCount * 4);
  for (let i = 0; i < voxelCount; i++) packedVolume.set(frame.response.subarray(i * 3, i * 3 + 3), i * 4);
  const params = new Float32Array(28);
  params.set([...frame.dimensions, frame.periodic ? 1 : 0], 0);
  params.set([...frame.origin, 0], 4);
  params.set([...frame.spacing, width], 8);
  params.set([...plane.origin, height], 12);
  params.set([...plane.axisU, plane.extentU], 16);
  params.set([...plane.axisV, plane.extentV], 20);
  params.set([thresholds.stiffnessTolerance, thresholds.neutralTolerance, thresholds.antisymmetryTolerance, 0], 24);
  const outputBytes = width * height * 12 * 4;
  const volumeBuffer = createBuffer(device, "P1 response volume", packedVolume, GPUBufferUsage.STORAGE);
  const paramsBuffer = createBuffer(device, "Equilibrium plane parameters", params, GPUBufferUsage.UNIFORM);
  const outputBuffer = device.createBuffer({ label: "Equilibrium GPU output", size: outputBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  const readback = device.createBuffer({ label: "Equilibrium parity readback", size: outputBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const bindGroup = device.createBindGroup({
    label: "Equilibrium plane bindings",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: volumeBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });
  const commands = device.createCommandEncoder({ label: "Equilibrium plane command encoder" });
  const pass = commands.beginComputePass({ label: "Equilibrium plane pass" });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  commands.copyBufferToBuffer(outputBuffer, 0, readback, 0, outputBytes);
  device.queue.submit([commands.finish()]);
  await readback.mapAsync(GPUMapMode.READ);
  const raw = new Float32Array(readback.getMappedRange().slice(0));
  const response = new Float32Array(width * height * 4);
  const eigenvalues = new Float32Array(width * height * 3);
  const antisymmetry = new Float32Array(width * height);
  const classes = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    response.set(raw.subarray(i * 12, i * 12 + 4), i * 4);
    eigenvalues.set(raw.subarray(i * 12 + 4, i * 12 + 7), i * 3);
    antisymmetry[i] = raw[i * 12 + 8]!;
    classes[i] = Math.round(raw[i * 12 + 9]!);
  }
  readback.unmap();
  volumeBuffer.destroy(); paramsBuffer.destroy(); outputBuffer.destroy(); readback.destroy();
  const info = adapter.info;
  const result: PlaneResult = { width, height, response, eigenvalues, antisymmetry, classes, backend: "WEBGPU", elapsedMs: performance.now() - started };
  return { result, adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description } };
}
