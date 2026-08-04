import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { ComputeResult, FirstHitResult, Quat, RigidGroup, SceneDocumentV2, Vec3 } from "../app/contracts";

const ROLE_COLORS: Record<string, number> = {
  ARENA: 0xffbe5c, MOVABLE_BUFFER: 0x76f6c2, GUARD_CONTOUR: 0x5aa7ff,
  FAR_EXTERNAL_CONTOUR: 0xd99cff, NUMERICAL_EDGE_DIAGNOSTIC: 0x87a09a,
};

export interface ViewportStats { visible_instances: number; render_ms: number; fps: number }

export class SceneLabViewport {
  private readonly scene = new THREE.Scene(); private readonly camera = new THREE.PerspectiveCamera(42, 1, .01, 100);
  private readonly renderer: THREE.WebGLRenderer; private readonly orbit: OrbitControls; private readonly transform: TransformControls;
  private readonly root = new THREE.Group(); private bodyMesh: THREE.InstancedMesh | null = null; private elementMesh: THREE.InstancedMesh | null = null; private diagnosticMesh: THREE.InstancedMesh | null = null;
  private document: SceneDocumentV2 | null = null; private selectedId: string | null = null; private bodyIds: string[] = []; private elementRanges = new Map<string, { start: number; count: number }>(); private readonly proxy = new THREE.Object3D(); private frame = 0; private lastRenderMs = 0; private fpsFrames = 0; private fpsStarted = performance.now(); private measuredFps = 0;
  constructor(private readonly container: HTMLElement, private readonly onSelect: (id: string) => void, private readonly onTransform: (id: string, p: Vec3, q: Quat) => void, private readonly onEditing: (active: boolean) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.domElement.dataset.testid = "viewport-canvas"; container.append(this.renderer.domElement);
    this.camera.position.set(6, 4.5, 6); this.orbit = new OrbitControls(this.camera, this.renderer.domElement); this.orbit.enableDamping = true; this.orbit.dampingFactor = .06;
    this.transform = new TransformControls(this.camera, this.renderer.domElement); this.scene.add(this.transform.getHelper()); this.scene.add(this.proxy); this.proxy.visible = false;
    this.transform.addEventListener("dragging-changed", (event) => { const dragging = Boolean(event.value); this.orbit.enabled = !dragging; this.onEditing(dragging); });
    this.transform.addEventListener("objectChange", () => { if (this.selectedId) { this.onTransform(this.selectedId, this.proxy.position.toArray() as Vec3, this.proxy.quaternion.toArray() as Quat); if (this.document) this.syncTransforms(this.document); } });
    this.scene.add(this.root, new THREE.HemisphereLight(0xcaffed, 0x101817, 2.5)); const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 3); this.scene.add(key);
    const grid = new THREE.GridHelper(16, 32, 0x355e52, 0x173029); grid.position.y = -2.2; this.scene.add(grid);
    this.renderer.domElement.addEventListener("pointerdown", (event) => this.pick(event)); new ResizeObserver(() => this.resize()).observe(container); this.resize(); this.animate();
  }
  private animate = () => { const start = performance.now(); this.orbit.update(); this.renderer.render(this.scene, this.camera); this.lastRenderMs = performance.now() - start;this.fpsFrames+=1;if(start-this.fpsStarted>=1000){this.measuredFps=this.fpsFrames*1000/(start-this.fpsStarted);this.fpsFrames=0;this.fpsStarted=start;}this.frame = requestAnimationFrame(this.animate); };
  private resize() { const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }
  private disposeMesh(mesh: THREE.InstancedMesh | null) { if (!mesh) return; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); this.root.remove(mesh); }
  setScene(document: SceneDocumentV2) {
    this.document = document; this.disposeMesh(this.bodyMesh); this.disposeMesh(this.elementMesh); this.bodyIds = []; this.elementRanges.clear();
    const visible = document.objects.filter((body) => body.visible); this.bodyMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 9), new THREE.MeshStandardMaterial({ roughness: .35, metalness: .08, transparent: true, opacity: .72 }), visible.length);
    this.bodyMesh.name = "instanced-positive-bodies"; const matrix = new THREE.Matrix4(), colour = new THREE.Color();
    visible.forEach((body, i) => { matrix.compose(new THREE.Vector3(...body.transform.position), new THREE.Quaternion(...body.transform.rotation), new THREE.Vector3(body.outer_radius, body.outer_radius, body.outer_radius)); this.bodyMesh!.setMatrixAt(i, matrix); colour.setHex(body.representation_mode === "CM_CONTROL" ? 0xd99cff : ROLE_COLORS[body.kou_role ?? body.body_role] ?? (body.world_locked ? 0x5aa7ff : 0xffbe5c)); this.bodyMesh!.setColorAt(i, colour); this.bodyIds.push(body.object_id); });
    this.bodyMesh.instanceMatrix.needsUpdate = true; this.bodyMesh.instanceColor!.needsUpdate = true; this.root.add(this.bodyMesh);
    const count = visible.reduce((sum, b) => sum + (b.representation_mode === "RIGID_VOLUME" ? b.packing.display_count : 0), 0);
    this.elementMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), new THREE.MeshStandardMaterial({ color: 0xcfffea, roughness: .5 }), count);
    let cursor = 0; const tmp = new THREE.Object3D();
    for (const body of visible) if (body.representation_mode === "RIGID_VOLUME") {
      this.elementRanges.set(body.object_id, { start: cursor, count: body.packing.display_count });
      for (let i = 0; i < body.packing.display_count; i += 1) { this.setElementMatrix(this.elementMesh, cursor++, body, i, tmp); }
    }
    this.elementMesh.instanceMatrix.needsUpdate = true; this.root.add(this.elementMesh); this.setSelected(document.objects[0]?.object_id ?? null);
  }
  private setElementMatrix(mesh: THREE.InstancedMesh, index: number, body: RigidGroup, localIndex: number, tmp = new THREE.Object3D()) {
    const base = body.voxel_elements[localIndex % body.voxel_elements.length]!.local_position; const cycle = Math.floor(localIndex / body.voxel_elements.length); const jitter = cycle ? .007 * ((localIndex * 16807) % 11 - 5) : 0;
    const local = new THREE.Vector3(base[0] + jitter, base[1] - jitter * .5, base[2] + jitter * .25).applyQuaternion(new THREE.Quaternion(...body.transform.rotation));
    tmp.position.set(body.transform.position[0] + local.x, body.transform.position[1] + local.y, body.transform.position[2] + local.z); tmp.scale.setScalar(Math.min(.035, body.outer_radius * .09)); tmp.updateMatrix(); mesh.setMatrixAt(index, tmp.matrix);
  }
  syncTransforms(document: SceneDocumentV2) {
    this.document = document; if (!this.bodyMesh || !this.elementMesh) return;
    const matrix = new THREE.Matrix4(), tmp = new THREE.Object3D();
    this.bodyIds.forEach((id, index) => { const body = document.objects.find((candidate) => candidate.object_id === id); if (!body) return; matrix.compose(new THREE.Vector3(...body.transform.position), new THREE.Quaternion(...body.transform.rotation), new THREE.Vector3(body.outer_radius, body.outer_radius, body.outer_radius)); this.bodyMesh!.setMatrixAt(index, matrix); const range = this.elementRanges.get(id); if (range) for (let i = 0; i < range.count; i += 1) this.setElementMatrix(this.elementMesh!, range.start + i, body, i, tmp); });
    this.bodyMesh.instanceMatrix.needsUpdate = true; this.elementMesh.instanceMatrix.needsUpdate = true;
  }
  setSelected(id: string | null) {
    this.selectedId = id; if (!this.document || !id) { this.transform.detach(); return; }
    const body = this.document.objects.find((candidate) => candidate.object_id === id); if (!body) return;
    this.proxy.position.fromArray(body.transform.position); this.proxy.quaternion.fromArray(body.transform.rotation); this.proxy.visible = false; this.transform.attach(this.proxy);
  }
  setTransformMode(mode: "translate" | "rotate") { this.transform.setMode(mode); }
  setTransformSpace(space: "local" | "world") { this.transform.setSpace(space); }
  setSnaps(position: number | null, rotationDegrees: number | null) { this.transform.setTranslationSnap(position); this.transform.setRotationSnap(rotationDegrees === null ? null : THREE.MathUtils.degToRad(rotationDegrees)); }
  showFirstHit(result: FirstHitResult | null) {
    this.disposeMesh(this.diagnosticMesh); this.diagnosticMesh = null; if (!result) return;
    this.diagnosticMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 4, 3), new THREE.MeshBasicMaterial({ vertexColors: true }), result.direction_count);
    const dummy = new THREE.Object3D(), color = new THREE.Color(); result.directions.forEach((d, i) => { const value = Number.isFinite(result.distances[i]!) ? result.distances[i]! : 5; dummy.position.set(d[0] * value, d[1] * value, d[2] * value); dummy.updateMatrix(); this.diagnosticMesh!.setMatrixAt(i, dummy.matrix); this.diagnosticMesh!.setColorAt(i, color.setHex(Number.isFinite(result.distances[i]!) ? 0x76f6c2 : 0xff805c)); });
    this.diagnosticMesh.instanceMatrix.needsUpdate = true; this.diagnosticMesh.instanceColor!.needsUpdate = true; this.root.add(this.diagnosticMesh);
  }
  updateResults(_result: ComputeResult) { /* force ledgers are rendered in the control desk */ }
  stats(): ViewportStats { return { visible_instances: (this.bodyMesh?.count ?? 0) + (this.elementMesh?.count ?? 0) + (this.diagnosticMesh?.count ?? 0), render_ms: this.lastRenderMs, fps: this.measuredFps }; }
  screenshot(): string { return this.renderer.domElement.toDataURL("image/png"); }
  private pick(event: PointerEvent) { if (!this.bodyMesh) return; const rect = this.renderer.domElement.getBoundingClientRect(), pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera); const hit = ray.intersectObject(this.bodyMesh)[0]; if (hit?.instanceId !== undefined) { const id = this.bodyIds[hit.instanceId]; if (id) { this.setSelected(id); this.onSelect(id); } } }
  destroy() { cancelAnimationFrame(this.frame); this.orbit.dispose(); this.transform.dispose(); this.renderer.dispose(); this.container.replaceChildren(); }
}
