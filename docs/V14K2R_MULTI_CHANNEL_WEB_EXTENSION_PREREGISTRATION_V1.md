# V14K2R N54 multi-channel WebGPU extension preregistration V1

Date: 2026-08-11

Base: `e1e740e3f4a27fa08ab0efa95925c60c7ce3ae8a`

The published WebGPU equilibrium instrument remains immutable at
`WEBGPU_INSTRUMENT_PASS_ONLY / ACTION_READOUT_NOT_SOURCE_FORCE`. This additive
extension accepts a governed V14K2R packet and exposes exactly five channels:

```text
ACTION_K2_STATE_MINUS_REFERENCE_W1_FINITE
ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC
SOURCE_MATERIAL_FORCE_PERIODIC
SOURCE_ACTION_FORCE_PERIODIC
SOURCE_TOTAL_FORCE_PERIODIC
```

Every channel uses the existing `cpuReference.ts`, WebGPU plane classifier and
branch tracker. No channel-specific threshold, scale, opacity, axis, density
label or component identity is permitted.

The public site may carry a bounded playback subset. The full source-native
packet and full root timeline remain governed external artifacts with hashes;
the browser subset may not silently replace them as scientific evidence.

Claim ceiling:

```text
SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM
NO W1=TOTAL-FORCE EQUIVALENCE
NO DIPOLE / UPOR / SCALE / VALIDATION / CANON PROMOTION
```
