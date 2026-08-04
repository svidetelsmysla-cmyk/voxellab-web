# VoxelLab Scene Lab V2 — preregistration

```text
TASK_ID = CODEX_WEB_VOXELLAB_SCENE_LAB_V2_FULL_SCENE_SUITE_V1
BASE = a8e3413d2d8ff88b5df990f59626443a04c9fa05
BRANCH = agent/web/voxellab-scene-lab-v2-full-suite-v1
RUNTIME_CLASS = USER_FACING_INTERACTIVE_SCENE_LAB
AUTHORITY = BROWSER_PREVIEW_ONLY
```

## Frozen implementation scope

- migrate v1 scenes into `SceneDocumentV2` and keep v1 import compatibility;
- separate editor, simulation, rendering, packing, KOU, first-hit, packet,
  import/export, diagnostics and performance modules;
- expose independent `dt`, substeps, playback and FPS controls;
- use deterministic symplectic Euler with damping disabled by default;
- support multi-body translation/rotation and explicit lock state;
- generate genuine SC, BCC, FCC, HCP and imported-point layouts;
- generate exact antipodal KOU tiers with `n_k = 2 m k^2`;
- calculate first-hit coverage, hole and chrysanthemum diagnostics;
- ship a MaxScript exporter and a browser-safe import fixture;
- load S01–S17 and execute each according to its declared run class;
- retain governed packets as read-only authority.

## Frozen controls

```text
dt = 1e-5 .. 5e-2
substeps = 1,2,4,8,16,32,64,128,256
playback = 0.1x .. 1000x
fps cap = 15,30,60,unlimited
damping default = OFF

KOU TINY = 2 tiers
KOU M0_K4 = m=3, K=4, 180 bodies
KOU M0_K6 = m=3, K=6, 546 bodies

first-hit baseline = 16,384 directions
```

## Frozen engineering gates

- B1: two bodies with at least 512 compute elements each;
- B2: at least 20,000 visible packed elements;
- B3: at least 180 visible layered KOU bodies;
- B4: at least 50 simultaneously movable bodies;
- B5: at least 16,384 first-hit directions;
- no NaN/Infinity, exact positive amount ledger and no hidden damping;
- all 17 scenes load without console errors;
- dynamic scenes execute smoke and standard receipts;
- S04/S06/S12/S13/S14/S15 receive bounded long-run receipts or a measured
  engineering blocker;
- the public Pages URL must display the exact deployed commit.

## Interpretation ceiling

Scene receipts use `ENGINEERING_RUN_PASS`, `ENGINEERING_RUN_BLOCKED`,
`PREVIEW_RESULT_RECORDED`, `PACKET_ONLY` or `SETUP_ONLY`. No browser result is
scientific validation.

```text
NO_HIDDEN_DAMPING
NO_SINGLE_MOVABLE_BODY_LIMIT
NO_DECORATIVE_KOU
NO_FAKE_PACKING_MODE
NO_SILENT_RESOLUTION_REDUCTION
NO_BROWSER_PREVIEW_AS_AUTHORITY
NO_PRIVATE_DATA_EXPORT
NO_UPOR_VALIDATION
NO_DIPOLE_VALIDATION
NO_SCALE_BINDING
```
