# VoxelLab Action Equilibrium Maps V1

Status: `R14 / ACTION LAB / DIAGNOSTIC-ONLY / NOT FORCE VALIDATION`

## Purpose

A5 adds an animated equilibrium-map mode to Action Transport Lab. It reads a frozen, browser-safe projection of V14J and shows the topology of the axial action readout before, during and after the temporary `1 → 2 → 1` density-component history.

The browser does not rerun the substrate, regenerate density, fit roots or select a preferred far closure.

## Governed source

- scientific repository: `svidetelsmysla-cmyk/ghb-r6-bridge`;
- branch: `agent/continuous-substrate-v14-mechanics-reconstruction-v1`;
- V14J source HEAD: `12e0900a6cf83a9bb9ca4b57972c325e14597d7c`;
- full timeline SHA-256: `6c682dec72b5e08ccda296501512e5bba746da9f80cb7918944fa6d9a2780243`;
- V14J packet SHA-256: `9e5bd0f578421765157bc655bfd980d464dcdb1b83686ca4f47ef3e7e5ea70a7`.

The public packet retains exact tracked roots and slopes for twelve late-bifurcation frames, while the plotted profiles are a deterministic stride-3 projection of the 121-point source line. It is therefore a display projection, not a new numerical result.

## Classification ceiling

For the axial sampled field `F(s)=ΔW1_parallel(s)`:

- `dF/ds < 0`: `AXIAL WELL CANDIDATE`;
- `dF/ds > 0`: `AXIAL CREST / 3D SADDLE CANDIDATE`;
- slope within tolerance: `NEUTRAL / DEGENERATE`.

A one-dimensional diverging root is not called a proven three-dimensional saddle. Full well/saddle/neutral classification requires the transverse vector field and the eigenvalues of the symmetric Jacobian. The exported helper `classifySymmetricJacobian2D` already implements that packet-gated classification for a future vector-map packet.

## Display layers

1. axial `STATE_MINUS_REFERENCE_W1` profile;
2. local action-direction arrows;
3. exact tracked fixed-point markers;
4. optional normalized density overlay;
5. optional `-∫axis ΔW1_parallel ds` line integral;
6. time-dependent branch atlas;
7. finite frozen-box versus nearest-periodic closure switch;
8. late component count hidden by default.

The line integral is labelled `display only — NOT physical potential`. Potential terminology remains locked until source-force parity and curl/integrability gates pass.

## Current scientific status

- two-well topology: `ROBUST_DIAGNOSTIC`;
- exact coarse root positions: `BOUNDARY_SENSITIVE`;
- `W1 = physical source force`: `NOT_YET_ESTABLISHED`;
- full 2D/3D fixed-point class: `BLOCKED_UNTIL_TRANSVERSE_VECTOR_FIELD`.

V14K remains the next scientific gate: blind N54 high-cadence agreement among A4 roots, source-force restoring roots and density-max motion.
