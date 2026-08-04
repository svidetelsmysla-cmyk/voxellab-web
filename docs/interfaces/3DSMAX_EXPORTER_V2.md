# VoxelLab Scene Exporter V2

Run `tools/3dsmax/VoxelLabSceneExporter.ms` in 3ds Max, assign optional `vl_*`
user properties, select the intended nodes, and use **Export
*.voxellab.scene.json**. The output opens directly in Scene Lab V2.

Supported properties are `vl_role`, `vl_amount`, `vl_density`, `vl_kv`,
`vl_locked`, `vl_movable_translation`, `vl_movable_rotation`,
`vl_initial_velocity`, `vl_packing`, `vl_compute_resolution`, and
`vl_display_resolution`. Missing values receive visible exporter defaults.

The tracked S17 fixture covers three groups, hierarchy, mixed lock states,
initial linear/angular velocities, and an FCC-labelled positive body.

Manual gate not executed in this environment: open 3ds Max, create three
groups, run the exporter, load the generated file in the public app, move the
two unlocked bodies, run one step, export again, and compare transforms,
groups, roles, and lock states. Parser and browser round-trip tests execute
without requiring 3ds Max.

