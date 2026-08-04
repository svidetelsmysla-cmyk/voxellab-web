import type { Provenance, SceneDocument, SceneObject, Vec3, VoxelElement } from "./types";

const commit = import.meta.env.VITE_COMMIT_SHA || "LOCAL_UNPUBLISHED_BUILD";

const provenance = (source: string, claim = "ENGINEERING_PREVIEW_NOT_SCIENTIFIC_VALIDATION"): Provenance => ({
  source,
  producer_commit: commit,
  claim_ceiling: claim,
});

function volumeElements(amount: number, density: number, level: "V0" | "V1" = "V0"): VoxelElement[] {
  const coordinates = level === "V0" ? [-0.12, 0.12] : [-0.14, 0, 0.14];
  const count = coordinates.length ** 3;
  return coordinates.flatMap((x) => coordinates.flatMap((y) => coordinates.map((z) => ({
    local_position: [x, y, z] as Vec3,
    amount: amount / count,
    volume: amount / density / count,
  }))));
}

function body(
  id: string,
  name: string,
  position: Vec3,
  options: Partial<SceneObject> = {},
): SceneObject {
  const amount = options.amount ?? 1;
  const density = options.density ?? 1;
  const mode = options.representation_mode ?? "RIGID_VOLUME";
  return {
    object_id: id,
    group_id: options.group_id ?? id,
    parent_id: options.parent_id ?? null,
    display_name: name,
    body_role: options.body_role ?? "FORMED_BODY",
    representation_mode: mode,
    transform: options.transform ?? { position, rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    geometry_type: mode === "CM_CONTROL" ? "SPHERE" : "VOXEL_GROUP",
    outer_radius: options.outer_radius ?? 0.24,
    amount,
    density,
    k_v: options.k_v ?? 1,
    world_locked: options.world_locked ?? false,
    movable_translation: options.movable_translation ?? !(options.world_locked ?? false),
    movable_rotation: options.movable_rotation ?? false,
    fixed_far: options.fixed_far ?? false,
    visible: options.visible ?? true,
    voxel_level: mode === "CM_CONTROL" ? "CM" : options.voxel_level ?? "V0",
    voxel_elements: mode === "CM_CONTROL"
      ? [{ local_position: [0, 0, 0], amount, volume: amount / density }]
      : options.voxel_elements ?? volumeElements(amount, density, options.voxel_level === "V1" ? "V1" : "V0"),
    provenance: options.provenance ?? provenance("BUILT_IN_PUBLIC_MVP_SCENE"),
  };
}

function scene(
  id: string,
  name: string,
  description: string,
  doesNotClaim: string,
  objects: SceneObject[],
): SceneDocument {
  return {
    scene_version: "1.0",
    scene_id: id,
    display_name: name,
    description,
    does_not_claim: doesNotClaim,
    coefficient_c: 1,
    objects,
    provenance: provenance("CODEX_WEB_VOXELLAB_PUBLIC_MVP_GITHUB_PAGES_V1"),
  };
}

const cmControl = scene(
  "SCENE_01_CM_CONTROL",
  "CM control",
  "Two centre-mass controls expose the negative-control approximation.",
  "CM is not promoted to a physical body model.",
  [
    body("cm_source", "Fixed CM source", [-1.1, 0, 0], { representation_mode: "CM_CONTROL", world_locked: true, amount: 2 }),
    body("cm_receiver", "Movable CM receiver", [1.1, 0, 0], { representation_mode: "CM_CONTROL", amount: 1 }),
  ],
);

const lockedVolume = scene(
  "SCENE_02_WORLD_LOCKED_RIGID_VOLUME",
  "World-locked rigid volumes",
  "Positive distributed elements produce force and torque ledgers without motion.",
  "A world-locked control is not a static-equilibrium result.",
  [
    body("locked_a", "Locked volume A", [-1.05, -0.15, 0], { world_locked: true, amount: 2, voxel_level: "V1" }),
    body("locked_b", "Locked volume B", [1.05, 0.25, 0], { world_locked: true, amount: 1.4, voxel_level: "V1" }),
  ],
);

const movableVolume = scene(
  "SCENE_03_MOVABLE_RIGID_VOLUME",
  "Movable rigid volume",
  "A fixed distributed source and movable rigid group use the positive direct-action preview.",
  "The labelled stepper is not physical time or validation.",
  [
    body("volume_source", "Fixed rigid source", [-1.15, -0.12, 0], { world_locked: true, amount: 3, voxel_level: "V1", outer_radius: 0.32 }),
    body("volume_receiver", "Movable rigid receiver", [0.95, 0.32, 0.08], { amount: 1.5, voxel_level: "V1", outer_radius: 0.3 }),
  ],
);

const antipodalDirections: Vec3[] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
  [0.7071, 0.7071, 0], [-0.7071, -0.7071, 0],
  [0.7071, 0, 0.7071], [-0.7071, 0, -0.7071],
  [0, 0.7071, 0.7071], [0, -0.7071, -0.7071],
];

const kouObjects = antipodalDirections.map((direction, index) => body(
  `kou_${index.toString().padStart(2, "0")}`,
  `Fixed far KOU ${index + 1}`,
  [direction[0] * 2.7, direction[1] * 2.7, direction[2] * 2.7],
  {
    body_role: "FAR_EXTERNAL_CONTOUR",
    world_locked: true,
    fixed_far: true,
    amount: 0.5,
    outer_radius: 0.16,
  },
));

const kouDemo = scene(
  "SCENE_04_ANTIPODAL_KOU_DEMO",
  "Antipodal KOU demo",
  "Six exact positive antipodal pairs surround one movable formed body.",
  "This small visualization is not a converged KOU or boundary-adequacy verdict.",
  [body("kou_probe", "Movable arena body", [0.42, 0.16, -0.08], { amount: 1.25, voxel_level: "V1" }), ...kouObjects],
);

const packetViewer = scene(
  "SCENE_05_PACKET_VIEWER_DEMO",
  "Governed packet viewer",
  "A preview scene accompanies a read-only governed V2B3B packet.",
  "Loading a packet never silently recomputes or upgrades its verdict.",
  movableVolume.objects.map((item) => structuredClone(item)),
);

export const builtInScenes: Record<string, SceneDocument> = {
  [cmControl.scene_id]: cmControl,
  [lockedVolume.scene_id]: lockedVolume,
  [movableVolume.scene_id]: movableVolume,
  [kouDemo.scene_id]: kouDemo,
  [packetViewer.scene_id]: packetViewer,
};

export const defaultSceneId = "SCENE_03_MOVABLE_RIGID_VOLUME";

export function loadBuiltInScene(id: string): SceneDocument {
  const selected = builtInScenes[id];
  if (!selected) throw new Error(`Unknown built-in scene: ${id}`);
  return structuredClone(selected);
}
