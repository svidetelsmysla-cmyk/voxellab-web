# VoxelLab Web

Scene Lab V2 is a public interactive preview and scene-authoring tool for
browser-safe VoxelLab scenes and read-only governed result packets.

The diagnostics deck includes governed G4 ActionTally playback for the H0 and
R0–R3 resolved-versus-homogenized branches. It displays dimensionless
resultant/torque readouts while keeping physical force cadence-blocked.

A separate G4 bridge audit panel verifies the bounded public packet contract:
source hashes, G1–G10, global residuals, H0/R0–R3 closure, and the exact boundary
between exported summaries and positive per-cell channels that are not present
in the public V1 projection. Missing arrays are never reconstructed in the
browser.

The governed MR/DL catalogue publishes all MR00–MR07 current ActionTally
replays and all DL00–DL07 available matched-residual diagnostics. The two
source lanes remain visibly separate.

Action Transport Lab now extends through A5. A3 reads complete first-owner
continuous columns for uniform formed-domain fixtures. A4 adds the strict
read-only `VOXELLAB_CONTINUOUS_FIELD_SNAPSHOT_V1` contract and evaluates
`Sigma=integral rho ds`, `W0`, `W1`, `W2`, real `P1-P4`, projection limits and
curl diagnostics. A5 reads a frozen browser-safe projection of the V14J axial
`STATE_MINUS_REFERENCE_W1` timeline and animates converging, diverging and
neutral fixed-point candidates, finite-versus-nearest closure sensitivity,
density overlay and branch persistence through the late `1 → 2 → 1` component
labels.

A5 deliberately stops at the axial diagnostic ceiling. Converging roots are
labelled `AXIAL WELL CANDIDATE`; diverging roots are labelled
`AXIAL CREST / 3D SADDLE CANDIDATE`. The displayed negative axis integral is
not a physical potential. Full two- or three-dimensional well/saddle/neutral
classification remains blocked until transverse vector/Jacobian channels are
exported, and `W1 = physical source force` remains unestablished pending V14K.

Live site: <https://svidetelsmysla-cmyk.github.io/voxellab-web/>

## Preview and authority boundary

- **PREVIEW** means an interactive browser calculation with deterministic
  multi-body motion and explicit evaluation-method labels.
- **AUTHORITATIVE** means a governed packet loaded read-only. The browser does
  not silently recompute or promote scientific verdicts.
- **A4 METHOD ORACLE** means a synthetic representation/integration control.
  It is not a V5, V6 or V14 source state.
- **A5 EQUILIBRIUM ATLAS** means a read-only display projection of frozen V14J
  line data. It does not rerun the substrate, refit roots, reveal source force,
  or convert axial action topology into a dipole or force-law claim.

This public repository contains only the web application, browser-safe demo
data, interface documentation, and deployment metadata. It does not contain the
private scientific corpus, governance registries, research archives, or
unpublished solver packets.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
node scripts/runActionEquilibriumMapGate.mjs
pnpm a4:gate
pnpm cavity:gate
pnpm suite
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

With `pnpm preview` running on port 4173, `pnpm benchmark:browser` executes the
full five-minute B1-B5 responsiveness and memory receipt. Hardware-browser FPS
is recorded separately from software-rendered headless portability results.

The production Vite base is `/voxellab-web/` for GitHub Pages.

## Interfaces

- `docs/interfaces/VOXELLAB_WEB_MVP_V1.md`
- `docs/interfaces/VOXELLAB_BROWSER_PACKET_SCHEMA_V1.md`
- `docs/interfaces/3DSMAX_EXPORT_CONTRACT_V1.md`
- `docs/interfaces/VOXELLAB_SCENE_LAB_V2.md`
- `docs/interfaces/VOXELLAB_G4_ACTION_TALLY_PLAYBACK_V1.md`
- `docs/interfaces/VOXELLAB_G4_ACTION_TALLY_AUDIT_PANEL_V1.md`
- `docs/interfaces/VOXELLAB_MR_DL_MATCHED_RESIDUAL_PLAYBACK_V1.md`
- `docs/interfaces/3DSMAX_EXPORTER_V2.md`
- `docs/interfaces/VOXELLAB_ACTION_TRANSPORT_LAB_A3_FIRST_HIT_CONTINUOUS_COLUMN_V1.md`
- `docs/interfaces/VOXELLAB_A4_V14_CONTINUOUS_FIELD_ACTION_BRIDGE_V1.md`
- `docs/interfaces/VOXELLAB_ACTION_EQUILIBRIUM_MAPS_V1.md`
- `docs/tasks/VOXELLAB_A4_V14_CONTINUOUS_FIELD_RESEARCH_PLAN_V1.md`

## Credits and scope

VoxelLab carries conceptual and engineering lineage associated with Viktor,
GydruS, and SWS. This credit records provenance only; it does not convert the
browser preview into scientific validation or attribute unsupported claims.

No upor, dipole, physical scale, physical cadence, or validation claim is made.

## License

See `LICENSE`. Public visibility does not grant permission beyond the terms in
that file.
