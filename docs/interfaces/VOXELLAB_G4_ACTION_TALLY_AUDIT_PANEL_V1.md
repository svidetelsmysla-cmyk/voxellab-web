# VoxelLab G4 ActionTally audit panel V1

## Purpose

The public Scene Lab already displays resultant action, torque action and the
signed resolved-minus-homogenized diagnostic from the governed G4 packet. This
panel adds an independent browser-side **contract audit of the public bounded
projection**.

It does not rerun the scientific operator and does not reconstruct omitted
cell arrays.

## Verified source identity

```text
PRODUCER COMMIT =
  3dc1466fffa4a0ea79a4eb3f0a8ab8aba10d4bba

SOURCE NPZ SHA256 =
  952c35c79940150860e03acf7cb3c5206242d554d999ad9b6ba91e3b4b6df7af

SOURCE MANIFEST SHA256 =
  9829c1c8b48a26a900149a48b3d8e0cd03700938721d914f601b0bf83581af9b

INCIDENT PACKET SHA256 =
  b4dff92aa026f6059bf492e54b056fdb2e6e6d60f3555e4f860ea20329e076be
```

## Audit checks

The panel rejects the packet unless:

```text
verdict = ACTION_TALLY_RESOLVED_MINUS_HOMOGENIZED_BRIDGE_PASS;
claim ceiling remains a dimensionless diagnostic;
physical_force_available = false;
secondary verdict = CADENCE_TO_FORCE_BLOCKER;
G1-G10 are exactly PASS;
global registered residuals remain <= 1e-12;
H0 and R0 preserve the exact residual null;
R1-R3 receiver/structure resultant deltas close pairwise;
all package and ledger identifiers are complete SHA256 values.
```

## Public channel coverage

The governed source package contains positive channels:

```text
incident_action
straight_surviving_action
straight_deficit_action
redirected_action
escaped_action
trapped_action
unresolved_action
body_transfer
body_torque
```

The current public V1 projection exports:

```text
incident M0 aggregate;
body resultant summaries;
body torque summaries;
resolved-minus-homogenized signed summaries.
```

It does not export the per-cell positive channel arrays. The panel states this
explicitly as:

```text
NOT_EXPORTED_IN_PUBLIC_PROJECTION_V1
```

No missing channel is inferred from resultants or reconstructed from rendered
pixels.

## Authority boundary

```text
PACKET_AUDIT_PASS =
  public bounded projection satisfies its declared contract.

NOT =
  physical force pass;
  cadence pass;
  wave-to-action pass;
  Upor or dipole validation;
  scale binding;
  canon promotion.
```

The signed `resolved_minus_homogenized` quantity remains a diagnostic
subtraction between two positive-channel resultants, not negative physical
action or matter.
