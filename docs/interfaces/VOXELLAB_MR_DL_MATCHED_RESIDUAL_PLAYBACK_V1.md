# VoxelLab MR/DL matched-residual playback V1

This interface exposes the available MR00–MR07 and DL00–DL07 governed
diagnostics in the public browser without reclassifying them as editable 3D
scenes or physical-force predictions.

## Two source lanes

### MR00–MR07

Source: current G4 ActionTally replay at
`3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba`.

The browser shows both the standard-null norm and the current
resolved-minus-homogenized ActionTally resultant/torque. These are distinct
quantities and must not be conflated.

### DL00–DL07

Source: available matched-residual diagnostic packet at
`586a891e408fdf595702278c80f55da7d871d8de`.

The browser preserves the exact scene definitions and `ZERO_WITHIN_FLOOR`
classifications. No current G4 ActionTally replay exists for the DL lane, so the
UI says `NOT_REPLAYED_ON_CURRENT_ACTION_TALLY` instead of inventing one.

## Authority boundary

```text
MR = CURRENT G4 ACTION TALLY PLAYBACK
DL = AVAILABLE LEGACY MATCHED-RESIDUAL DIAGNOSTIC
EDITABLE 3D SCENE = NO
PHYSICAL FORCE = NOT AVAILABLE
SCALE / VALIDATION / CANON PROMOTION = NO
```
