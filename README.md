# VoxelLab Web

Scene Lab V2 is a public interactive preview and scene-authoring tool for
browser-safe VoxelLab scenes and read-only governed result packets.

The diagnostics deck now includes governed G4 ActionTally playback for the
H0 and R0–R3 resolved-versus-homogenized branches. It displays dimensionless
resultant/torque readouts while keeping physical force cadence-blocked.

Live site: <https://svidetelsmysla-cmyk.github.io/voxellab-web/>

## Preview and authority boundary

- **PREVIEW** means an interactive browser calculation with deterministic
  multi-body motion and explicit evaluation-method labels.
- **AUTHORITATIVE** means a governed packet loaded read-only. The browser does
  not silently recompute or promote scientific verdicts.

This public repository contains only the web application, browser-safe demo
data, interface documentation, and deployment metadata. It does not contain
the private scientific corpus, governance registries, research archives, or
unpublished solver packets.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
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
- `docs/interfaces/3DSMAX_EXPORTER_V2.md`

## Credits and scope

VoxelLab carries conceptual and engineering lineage associated with Viktor,
GydruS, and SWS. This credit records provenance only; it does not convert the
browser preview into scientific validation or attribute unsupported claims.

No upor, dipole, physical scale, or validation claim is made.

## License

See `LICENSE`. Public visibility does not grant permission beyond the terms in
that file.
