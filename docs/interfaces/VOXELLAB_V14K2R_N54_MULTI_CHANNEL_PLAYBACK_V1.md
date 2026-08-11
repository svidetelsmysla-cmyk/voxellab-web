# V14K2R N54 multi-channel playback V1

## Authority boundary

The browser loads a bounded, hash-verified projection of a governed source
packet. It does not generate the N54 dynamics and does not replace the full
151-frame scientific artifact.

The public projection contains the preregistered frames at `t=40`, `t=55`,
and `t=70`. Every float32 blob retains its own SHA-256 descriptor and the
manifest links back to the complete float64 packet payload hash.

Published packet locks:

```text
full N54 source payload SHA256 =
  8e8479c3b69acbe9b1ebdcea25a26808d4c3a7316f98e06383432f3dd601bcea

public subset manifest SHA256 =
  07e56a4aacd2db8b8703efecf7bb5c77ea56e98432c1b2e5dff8e07704cc0f23

public vector/scalar payload bytes =
  30233088

public neutral-timeline SHA256 =
  71cc464ad3693939c9838dbc9f11357d03a45e76d6850dabf7b2ef111600ad71
```

## Frozen channels

Exactly five vector channels are available:

1. `ACTION_K2_STATE_MINUS_REFERENCE_W1_FINITE`
2. `ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC`
3. `SOURCE_MATERIAL_FORCE_PERIODIC`
4. `SOURCE_ACTION_FORCE_PERIODIC`
5. `SOURCE_TOTAL_FORCE_PERIODIC`

The first two are action-readout representations with the ceiling
`NOT_SOURCE_FORCE`. The remaining three are periodic source branches. Physical
equilibrium topology is classified only from `SOURCE_TOTAL_FORCE_PERIODIC`.

No channel receives per-frame normalization, a fitted threshold, or a
channel-specific root algorithm.

## Shared classifier

CPU and WebGPU use the same published full-3D root/Jacobian/eigenvalue
classifier and the same frame-neutrality rule. WebGPU failure may select the
CPU reference implementation, but it may not change channel semantics or
scientific labels.

The browser receipt records the packet payload hash, selected channel, frame,
neutral tolerance, and root count.

The public `root_timeline.json` deliberately carries only the exact neutral
tolerances. Full root objects remain in the governed 151-frame analysis; the
browser recomputes the selected frame's roots from the hash-verified 54-cubed
vector field. This prevents a multi-gigabyte derived JSON from becoming a
second, lossy scientific packet.

Local production verification:

```text
TypeScript typecheck = PASS
Vitest = 117 PASS
production build = PASS
Chromium N54 packet/hash/channel E2E = PASS
```

## Claim ceiling

The maximum browser claim is:

```text
SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM
```

This is not a dipole, upor, scale, cadence, physical-force, validation, or
canon-promotion claim.
