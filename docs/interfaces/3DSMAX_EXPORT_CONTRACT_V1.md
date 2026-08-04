# 3ds Max to VoxelLab rigid-group export contract v1

## Scope

This contract prepares a future dedicated MaxScript exporter. MVP v1 accepts
the resulting JSON but does not ship or claim a complete mesh exporter.

## Mapping

| 3ds Max concept | VoxelLab field |
|---|---|
| Node handle/name | `object_id` / `display_name` |
| Parent node | `parent_id` |
| Rigid assembly name | `group_id` |
| World position/quaternion/scale | `transform` |
| User property `body_role` | `body_role` |
| User property `representation_mode` | `representation_mode` |
| User property `amount` | `amount` |
| User property `density` | `density` |
| User property `k_v` | `k_v` |
| Locked transform | `world_locked` |
| Local positive sample points | `voxel_elements[].local_position` |

## Invariants

- Export one record per rigid body group, not one physical claim per mesh node.
- Store voxel positions in the rigid group's local coordinates.
- Export positive `amount`, `volume`, `density` and `k_v` only.
- The sum of voxel-element amounts must equal the body amount.
- Preserve the group quaternion and do not bake a moving group into world-space
  voxel coordinates.
- Mark centre-mass records `CM_CONTROL`; never silently treat them as the
  physical primary representation.
- Do not export a visual gap as negative matter.
- Units remain scene-local and carry no physical-scale claim.

## Example

See `docs/interfaces/examples/3DSMAX_RIGID_GROUP_EXAMPLE_V1.json`.

## Deferred work

Node traversal, modifiers, instancing, coordinate-system conversion and a
signed MaxScript package belong to the next dedicated interface task. They do
not block the static public MVP.
