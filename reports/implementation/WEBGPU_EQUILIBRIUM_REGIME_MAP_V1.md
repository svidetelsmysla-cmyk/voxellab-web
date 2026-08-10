# WebGPU equilibrium regime map V1

## 1. Executive verdict

```text
MAIN_VERDICT = WEBGPU_INSTRUMENT_PASS_ONLY
SOFTWARE_VERDICT = WEBGPU_EQ_MAP_SOFTWARE_PASS
SCIENTIFIC_LEVEL = 2 / NUMERICALLY_PARITY_CHECKED_INSTRUMENT
CLAIM_CEILING = ACTION_READOUT_NOT_SOURCE_FORCE
```

The P1 N16 action-response volume is now an interactive WebGPU instrument with
an independent TypeScript CPU oracle, full 3D stiffness classification,
deterministic root refinement, density-independent branch playback, separate
finite/nearest-periodic closures, neutral-transition contours and explicit
source/receiver/render resolution badges. It is not a source-force or physical
stability result.

## 2. Exact source and provenance

- web base: `ca4ff979b4aa70b3b3123fc158f2c29c9c4e8bee`;
- web preregistration: `0a968c11d657530b861332b3c34f608a38ba3482`;
- web implementation: `d9e2825091066a22fe40f170d1a4c3fece8c00de`;
- physics base: `7172b5a96c647b3f1d12e2a1daad378d59f7b72e`;
- source/export packet commit: `69394a8eb261c9899e098b06d0234e54e5887dad`;
- preregistration hash: `142e7f86f7c82416b6235cf26340bad6c93d670f55566acbfe1b755374d19756`;
- P1 manifest hash: `225d6e36d221816247e9c2465cc0b9f9816b04c3d9f1ac7d5688aaab0e3bb912`.

The source packet contains 36 same-time frames on a 16³ node-centred volume.
`rho`, finite response and nearest-periodic response hashes were verified in
the browser before compute. The offline float64→float32 checkpoint maximum was
`8.823704067021503e-08`.

## 3. Implemented architecture

```text
immutable P1 response volume
→ hash-verified browser load
→ cached WebGPU adapter/device/pipeline
→ arbitrary registered 3D plane sample
→ full 3×3 finite-difference J
→ K = -sym(J), eigenvalues, antisymmetry ratio
→ regime map + numeric zero-crossing contours + response streamlines

same full 3D volume
→ component sign brackets
→ exact trilinear-cell Jacobian Newton refinement
→ full 3D qualification
→ global minimum-cost temporal assignment
→ two-frame persistence playback
```

The zero response at frame 0 is treated as a degenerate continuum, not 3,375
invented discrete roots. The preregistered neutral rule is
`max(1e-6, 1e-3·p95(|κ|))` separately for each frame/closure. Density is only a
same-frame optional display overlay.

## 4. Numerical parity

Real Chrome 151 WebGPU on the owner machine exposed an `nvidia / lovelace`
adapter. At frame 12 (`t=24`):

| closure | response relative L2 | mean cosine | eigen sign | class |
|---|---:|---:|---:|---:|
| finite box | 2.03e-7 | 1.0000000 | 100.000% | 100.000% |
| nearest periodic | 2.14e-7 | 1.0000000 | 100.000% | 100.000% |

The identically zero frame-0 control also passes exactly: relative L2 `0`,
cosine `1`, eigen sign `100%` by an explicitly registered empty-nonzero-set
rule, and class `100%`.

## 5. Root and branch findings

The root table hash is
`0ef5a9620b4ee5fc813c86c9ed6faeb4bf5e852f5e36b06b638702eb3f185352`.

- finite: 975 root observations, 65 branches, 64 surviving the two-frame
  persistence rule, maximum relative residual `1.9579354977073316e-4`;
- nearest periodic: 816 observations, 63 branches, 60 persistent, maximum
  relative residual `1.3864721930551807e-4`.

These counts describe the N16 action readout under the frozen root tolerance.
They are not body counts, matter objects or evidence for a dipole.

## 6. Resolution and boundary findings

Root extraction uses the full source response volume, so receiver and render
upscaling cannot create numeric roots. The 41×33 CPU↔GPU parity grid and
129×97/257×193/513×385 display grids share the same root table.

Source refinement is unresolved because N48/N54 packets are absent. Closure is
materially consequential at N16. At frame 12 the finite lane has 12 roots
(8 repelling, 3 saddle-index-2, 1 restoring), while nearest-periodic has 8
(4 saddle-index-1, 3 saddle-index-2, 1 restoring). Finite roots have mean
nearest periodic-root distance `8.94899` world units. Classification:
`BOUNDARY_CREATED_OR_DESTROYED_BRANCH_AT_N16`. No intrinsic near-mechanics
claim is allowed.

## 7. V14K holdout

`BLOCKED_EXACT_N54_V14K_SOURCE_PACKET_ABSENT`. See
`WEBGPU_EQ_MAP_SOURCE_ACTION_HOLDOUT_V1.md`. No source force was inferred from
action geometry.

## 8. Density-following result

Scientific density following was not executed because G11 did not open it.
The software no-material-lag gate passes: rho and response are sliced from the
same frame, density is off by default, and root candidates/matching never read
density.

## 9. Performance

With cached adapter/device/pipeline:

- 257×193: median `14.8 ms`, max `17.0 ms` across five frames;
- 513×385: median `45.0 ms`, max `51.1 ms`;
- preregistered cached target: `<100 ms` — PASS.

The default grid exceeds a 30 FPS compute budget. The 513×385 diagnostic grid
passes latency but is approximately 22 FPS from compute timing alone. N54 was
not benchmarked.

## 10. Falsifiers and repairs encountered

- a 2D well with divergent hidden direction is correctly a 3D saddle;
- frame 0 is a zero-field continuum, not thousands of roots;
- headless Chromium exposed the API but no adapter; the in-app Chrome produced
  a real NVIDIA receipt;
- two WGSL matrix-operator portability errors were localized before numeric
  comparison;
- finite/periodic topology differences block robust/intrinsic claims;
- missing N54/V14K data blocks source-force and density-following claims.

## 11. Verification

```text
TypeScript typecheck        PASS
Vitest                      112 passed
A4 method gate              PASS
Scene suite                 17 scenes / 0 blocked
Production build            PASS
Playwright standard         20 passed
Real WebGPU finite          PASS on NVIDIA
Real WebGPU nearest-periodic PASS on NVIDIA
```

## 12. Artifact hashes

| artifact | SHA256 |
|---|---|
| root timeline JSON | `0ef5a9620b4ee5fc813c86c9ed6faeb4bf5e852f5e36b06b638702eb3f185352` |
| finite/periodic comparison | `67974d44f9fe3e860075933a582a6867eed71ae32921317bfe996f7ed18d3e6f` |
| neutral-transition GIF | `9a863d2537e3669aadd13b65a87567e5dd273539f601c674d3b1f5edb7393f18` |
| branch timeline screenshot | `94b9898bcc81a88187d51c44602d9e099b4664660f6989ba7c3d5eef4dc45ab0` |
| frame-12 header/map | `e09f84c0d48d7f9141ee9d49c5ee88a7af6f388196912df25b7c8e7cf3107843` |
| parity screenshot | `ccd58eb5fb3231216493fda76039d9b57aa13498b31cbfa80d444e277bc97284` |
| root readout screenshot | `1b6ff9a8c2ebe5993bd6e78ab2b4e567d54cc0ba3681d49879f36d74057a506b` |

Recommended next gate: import the exact hash-locked N54/V14K packet and apply
the frozen comparison without changing axes, neutral rule, coefficients,
cadence or scale.
