# VoxelLab Web

Interactive Preview Solver for inspecting browser-safe VoxelLab scenes and
read-only governed result packets.

Live site: <https://svidetelsmysla-cmyk.github.io/voxellab-web/>

## Preview and authority boundary

- **PREVIEW** means an interactive browser calculation using WebGPU when an
  available adapter passes parity, with a CPU Worker fallback.
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
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The production Vite base is `/voxellab-web/` for GitHub Pages.

## Interfaces

- `docs/interfaces/VOXELLAB_WEB_MVP_V1.md`
- `docs/interfaces/VOXELLAB_BROWSER_PACKET_SCHEMA_V1.md`
- `docs/interfaces/3DSMAX_EXPORT_CONTRACT_V1.md`

## Credits and scope

VoxelLab carries conceptual and engineering lineage associated with Viktor,
GydruS, and SWS. This credit records provenance only; it does not convert the
browser preview into scientific validation or attribute unsupported claims.

No upor, dipole, physical scale, or validation claim is made.

## License

See `LICENSE`. Public visibility does not grant permission beyond the terms in
that file.
