# VoxelLab MR/DL public playback V1

## Result

All 16 requested identifiers are present in the public Scene Lab as governed
read-only diagnostic cases.

```text
MR00–MR07 = CURRENT_G4_ACTION_TALLY_REPLAY
DL00–DL07 = LEGACY_MATCHED_RESIDUAL_DIAGNOSTIC
EDITABLE_3D_SCENES = NO
PHYSICAL_FORCE_AVAILABLE = NO
```

The browser intentionally keeps the two source lanes separate. MR cases show
the standard-null norm and the current resolved-minus-homogenized ActionTally
resultant/torque. DL cases show the exact available legacy
`ZERO_WITHIN_FLOOR` receipt and are marked
`NOT_REPLAYED_ON_CURRENT_ACTION_TALLY`.

## Exact source lock

```text
CURRENT G4 COMMIT = 3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba
CURRENT G4 NPZ SHA256 = 952c35c79940150860e03acf7cb3c5206242d554d999ad9b6ba91e3b4b6df7af
CURRENT G4 MANIFEST SHA256 = 9829c1c8b48a26a900149a48b3d8e0cd03700938721d914f601b0bf83581af9b

LEGACY PACKET COMMIT = 586a891e408fdf595702278c80f55da7d871d8de
LEGACY NPZ SHA256 = 43d3d1fe0a60172cee214ba76990487ac46c81e78f7a21395fa7004af7e1cc03
LEGACY MANIFEST SHA256 = c4d9f939876ad40bc185c32ccafaef13ce0a90ca467c19b0dee6f479d74835f0

PUBLIC MR/DL PROJECTION SHA256 = 3879d34b6d68f0587d12bdbefaf6157f13091bd3ef27fb6e105e669a9f7de1af
```

Field-by-field comparison against `matched_mr00_mr07_replay.json`,
`scene_metadata.json`, and `residual_outputs.json` returned:

```text
MR_DL_PUBLIC_PROJECTION_EXACT_SOURCE_PARITY_PASS
cases = 16
mr_rows = 8
dl_rows = 8
```

## Local gates

```text
TypeScript typecheck = PASS
Vitest = 32 PASSED
Deterministic scene suite = 17 SCENES / 0 BLOCKED / 6 LONG RUNS
Production build = PASS
Playwright Chromium = 7 PASSED
MR/DL source projection parity = PASS
git diff --check = PASS
```

The confirmed GitHub runner timeout in the 17-scene Playwright test was
repaired by increasing only that test's timeout from 30 to 60 seconds. No
simulation, packet, or scientific threshold changed.

Updated browser evidence:

```text
docs/screenshots/SCENE_LAB_V2_TWO_MOVABLE_BODIES.png
SHA256 = f9763af9cb7f011a9876080f40a11d905450becd43487b0664675262e7c894af
```

No Upor, dipole, physical force, scale, validation, or canon promotion is
claimed.
