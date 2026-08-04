# VoxelLab public web MVP v1

## Product boundary

The application has two deliberately separate lanes:

1. **Browser preview** — an interactive engineering calculation using the
   positive direct-action operator. It can move already formed rigid groups
   with a labelled numerical stepper.
2. **Authoritative packet inspection** — read-only display of hashes, producer
   commit, verdict, ledgers and selected visual arrays exported from a governed
   repository packet. Loading a packet never invokes the preview solver.

Neither lane promotes a browser result to scientific validation.

## Application surface

The static Vite application lives at the public repository root and is served
below the repository Pages base `/voxellab-web/`. It has no backend, account,
committed secret, telemetry endpoint or paid dependency.

The first screen includes:

- an orbit/pan/zoom Three.js viewport;
- scene tree and selected-body inspector;
- Run, Stop, Step and Reset controls;
- WebGPU capability/parity receipt and CPU Worker fallback;
- force, torque and amount ledgers;
- scene JSON import/export;
- governed browser-packet loading and provenance;
- explicit PREVIEW and AUTHORITATIVE status cards.

## Preview operator

For receiver element `p` and source element `q` in different rigid groups:

```text
F[p<-q] = C * k_v[p] * N[p] * N[q]
          * (x[p] - y[q]) / |x[p] - y[q]|^3
```

All amounts are positive. Same-body pairs are excluded. A coincident
cross-body element stops the calculation visibly. No Gaussian, softening,
GRIN, opacity, attraction or terminal threshold is present.

`RIGID_VOLUME` keeps positive element coordinates fixed in a body-local frame
while the group transform moves. `CM_CONTROL` collapses the amount to one
control point and is visibly labelled as a control only.

## Compute backends

The browser checks secure context, `navigator.gpu`, adapter, device and selected
limits. The WebGPU shader uses one invocation per receiver element and reads
source elements in chunks of 128. Body force and torque are reduced after the
GPU calculation. A frozen small-scene comparison must pass relative tolerance
`1e-5` before WebGPU is made available to AUTO mode.

When WebGPU is absent or fails parity, the exact TypeScript operator runs in a
Web Worker. There is no silent formula change.

## Numerical motion

The preview stepper applies force divided by declared body amount, a default
step `0.0025`, and per-step damping `0.997`. This is a visualization control,
not physical time, scale binding or validation.

## Deployment

`.github/workflows/deploy-pages.yml` installs the frozen pnpm graph, runs
typecheck, unit tests, the production build and a Playwright smoke test, uploads
the Pages artifact and deploys it through GitHub's official Pages actions. The
workflow summary records the deployment URL and deterministic content hash of
the production directory.

THIS IS THE FIRST PUBLIC VOXELLAB WEB MVP.

THE BROWSER SOLVER IS AN INTERACTIVE PREVIEW.

AUTHORITATIVE SCIENTIFIC VERDICTS REMAIN GOVERNED REPOSITORY PACKETS.

NO UPOR, DIPOLE, SCALE OR VALIDATION IS CLAIMED.
