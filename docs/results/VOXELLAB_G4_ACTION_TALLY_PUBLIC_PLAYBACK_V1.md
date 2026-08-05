# VoxelLab G4 ActionTally public playback V1

## Result

The public Scene Lab now exposes a read-only browser projection of the governed
G4 ActionTally packet. Users can switch between `H0` and `R0–R3`, select the
receiver or structure body, and inspect resultant action, torque action, and
the signed resolved-minus-homogenized diagnostic.

```text
MAIN VERDICT = ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS
SECONDARY VERDICT = CADENCE_TO_FORCE_BLOCKER
PUBLIC ROLE = GOVERNED PACKET PLAYBACK, NOT BROWSER RECOMPUTATION
```

## Exact source lock

```text
SOURCE HEAD = 3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba
SOURCE NPZ SHA256 = 952c35c79940150860e03acf7cb3c5206242d554d999ad9b6ba91e3b4b6df7af
SOURCE MANIFEST SHA256 = 9829c1c8b48a26a900149a48b3d8e0cd03700938721d914f601b0bf83581af9b
INCIDENT PACKET SHA256 = b4dff92aa026f6059bf492e54b056fdb2e6e6d60f3555e4f860ea20329e076be
PUBLIC PROJECTION SHA256 = 45c2ef177623f74dcf90b6fefb5f550744a6a7e9131ee87aa2e5668fbc6fb141
```

An exact field-by-field comparison against the source summaries and delta file
returned `PUBLIC_PROJECTION_EXACT_SOURCE_PARITY_PASS` for all five branches.

## Local gates

```text
TypeScript typecheck = PASS
Vitest = 28 PASSED
Deterministic scene suite = 17 SCENES / 0 BLOCKED / 6 LONG RUNS
Production build = PASS
Playwright Chromium = 6 PASSED
Source projection parity = PASS
git diff --check = PASS
```

Updated full-page browser evidence:

```text
docs/screenshots/SCENE_LAB_V2_TWO_MOVABLE_BODIES.png
SHA256 = 648a128d3cac2089ba644ecc17d12280f3e2a57aaaf4df21a672910912d12fa7
```

## Firewalls

Path depth remains geometry/topology input, not action. Cell-integrated action
is not multiplied by solid angle a second time. A signed difference array is a
diagnostic, not negative physical matter or action. Physical force is not
available until cadence is bound. No Upor, dipole, scale, validation, or canon
promotion is claimed.
