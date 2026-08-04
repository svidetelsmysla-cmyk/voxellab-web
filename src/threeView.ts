import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ComputeResult, SceneDocument, SceneObject, Vec3 } from "./types";

const COLORS = {
  rigid: 0x76f6c2,
  movable: 0xffbe5c,
  cm: 0xd99cff,
  far: 0x5aa7ff,
  selected: 0xffffff,
  force: 0xff805c,
  torque: 0xb793ff,
};

interface BodyVisual {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  force: THREE.ArrowHelper;
  torque: THREE.ArrowHelper;
}

export class VoxelViewport {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly bodyVisuals = new Map<string, BodyVisual>();
  private readonly dynamicRoot = new THREE.Group();
  private selectedId: string | null = null;
  private animationId = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly onSelect: (objectId: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.dataset.testid = "viewport-canvas";
    this.container.append(this.renderer.domElement);
    this.camera.position.set(4.6, 3.4, 4.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0, 0);
    this.scene.add(this.dynamicRoot);
    this.scene.add(new THREE.HemisphereLight(0xbfffea, 0x17211d, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x679dff, 1.4);
    rim.position.set(-4, 1, -3);
    this.scene.add(rim);
    const grid = new THREE.GridHelper(10, 20, 0x28463e, 0x18302b);
    grid.position.y = -1.25;
    this.scene.add(grid);
    this.renderer.domElement.addEventListener("pointerdown", (event) => this.pick(event));
    new ResizeObserver(() => this.resize()).observe(this.container);
    this.resize();
    this.animate();
  }

  private animate = (): void => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private clearDynamic(): void {
    for (const child of [...this.dynamicRoot.children]) {
      child.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
      this.dynamicRoot.remove(child);
    }
    this.bodyVisuals.clear();
  }

  private baseColor(body: SceneObject): number {
    if (body.representation_mode === "CM_CONTROL") return COLORS.cm;
    if (body.fixed_far) return COLORS.far;
    return body.world_locked ? COLORS.rigid : COLORS.movable;
  }

  private bodyVisual(body: SceneObject): BodyVisual {
    const group = new THREE.Group();
    group.name = body.object_id;
    group.userData.objectId = body.object_id;
    group.visible = body.visible;
    group.position.fromArray(body.transform.position);
    group.quaternion.fromArray(body.transform.rotation);
    const materials: THREE.MeshStandardMaterial[] = [];
    const color = this.baseColor(body);
    const outerMaterial = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: body.representation_mode === "CM_CONTROL" ? 0.68 : 0.13,
      roughness: 0.28,
      metalness: 0.2,
      wireframe: body.representation_mode !== "CM_CONTROL",
    });
    materials.push(outerMaterial);
    const outerGeometry = body.representation_mode === "CM_CONTROL"
      ? new THREE.OctahedronGeometry(body.outer_radius, 2)
      : new THREE.SphereGeometry(body.outer_radius, 20, 12);
    const outer = new THREE.Mesh(outerGeometry, outerMaterial);
    outer.userData.objectId = body.object_id;
    group.add(outer);
    if (body.representation_mode === "RIGID_VOLUME") {
      const elementMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.08 });
      materials.push(elementMaterial);
      const elementRadius = Math.min(0.055, body.outer_radius * 0.22);
      for (const element of body.voxel_elements) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(elementRadius, 10, 8), elementMaterial);
        mesh.position.fromArray(element.local_position);
        mesh.userData.objectId = body.object_id;
        group.add(mesh);
      }
    }
    const centreMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.8 });
    materials.push(centreMaterial);
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), centreMaterial);
    centre.userData.objectId = body.object_id;
    group.add(centre);
    const force = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.001, COLORS.force, 0.08, 0.045);
    const torque = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.001, COLORS.torque, 0.07, 0.04);
    force.visible = false;
    torque.visible = false;
    group.add(force, torque);
    return { group, materials, force, torque };
  }

  private zoneSphere(radius: number, color: number, opacity: number): THREE.LineSegments {
    const geometry = new THREE.EdgesGeometry(new THREE.SphereGeometry(radius, 24, 14));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineSegments(geometry, material);
  }

  setScene(document: SceneDocument): void {
    this.clearDynamic();
    document.objects.forEach((body) => {
      const visual = this.bodyVisual(body);
      this.bodyVisuals.set(body.object_id, visual);
      this.dynamicRoot.add(visual.group);
    });
    if (document.scene_id === "SCENE_04_ANTIPODAL_KOU_DEMO") {
      const overlays = new THREE.Group();
      overlays.name = "KOU zone overlays";
      overlays.add(this.zoneSphere(1.0, 0x76f6c2, 0.2));
      overlays.add(this.zoneSphere(2.0, 0xffbe5c, 0.14));
      overlays.add(this.zoneSphere(2.5, 0x5aa7ff, 0.12));
      overlays.add(this.zoneSphere(3.25, 0xd99cff, 0.09));
      this.dynamicRoot.add(overlays);
    }
    this.setSelected(document.objects[0]?.object_id ?? null);
  }

  syncTransforms(document: SceneDocument): void {
    document.objects.forEach((body) => {
      const visual = this.bodyVisuals.get(body.object_id);
      if (!visual) return;
      visual.group.position.fromArray(body.transform.position);
      visual.group.quaternion.fromArray(body.transform.rotation);
      visual.group.visible = body.visible;
    });
  }

  updateResults(result: ComputeResult): void {
    result.bodies.forEach((body) => {
      const visual = this.bodyVisuals.get(body.object_id);
      if (!visual) return;
      this.updateArrow(visual.force, body.force, 0.18);
      this.updateArrow(visual.torque, body.torque, 0.25);
    });
  }

  private updateArrow(arrow: THREE.ArrowHelper, vector: Vec3, scale: number): void {
    const value = new THREE.Vector3(...vector);
    const magnitude = value.length();
    arrow.visible = magnitude > 1e-10;
    if (!arrow.visible) return;
    arrow.setDirection(value.normalize());
    arrow.setLength(Math.min(1.2, Math.log1p(magnitude) * scale + 0.08), 0.08, 0.045);
  }

  setSelected(objectId: string | null): void {
    this.selectedId = objectId;
    for (const [id, visual] of this.bodyVisuals) {
      visual.materials.forEach((material) => {
        material.emissive.setHex(id === objectId ? COLORS.selected : 0x000000);
        material.emissiveIntensity = id === objectId ? 0.3 : 0;
      });
    }
  }

  private pick(event: PointerEvent): void {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.bodyVisuals.values()].map((item) => item.group), true)[0];
    const objectId = hit?.object.userData.objectId as string | undefined;
    if (objectId) {
      this.setSelected(objectId);
      this.onSelect(objectId);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.controls.dispose();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
