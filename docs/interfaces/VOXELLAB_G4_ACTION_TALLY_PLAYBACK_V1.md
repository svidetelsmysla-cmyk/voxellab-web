# VoxelLab G4 ActionTally playback V1

The public Scene Lab loads `R12_G4_ACTION_TALLY_BROWSER_PLAYBACK_V1.json` as a
read-only bounded projection of the governed R12 G4 packet produced at commit
`3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba`.

## Visible branches

- `H0_HOMOGENIZED`
- `R0_FORWARD_PRESERVING`
- `R1_ISOTROPIC_REDIRECTION`
- `R2_SPECULAR_REDIRECTION`
- `R3_SOURCE_COMPATIBLE_CANDIDATE`

For receiver and structure bodies, the browser displays the cell-integrated
resultant action readout, torque action readout, and the signed
resolved-minus-homogenized diagnostic. The signed difference is not negative
physical action.

## Authority boundary

The browser does not recompute the governed packet and cannot alter its
verdict. The projection contains bounded summaries and hashes, not the private
scientific corpus or full cell arrays.

```text
PATH DEPTH = GEOMETRY / TOPOLOGY INPUT ONLY
ACTION TALLY = DIMENSIONLESS TRANSFER PER COMMON CYCLE
CELL ACTION ALREADY CONTAINS SOLID-ANGLE WEIGHT
PHYSICAL FORCE = UNAVAILABLE UNTIL CADENCE IS BOUND
```

Main verdict:

```text
ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS
```

Mandatory secondary verdict:

```text
CADENCE_TO_FORCE_BLOCKER
```

No scale, validation, Upor, dipole, or physical-force claim is made.
