# VoxelLab A4 / V14 continuous-field action bridge V1

## Status

```text
A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_PASS
A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER
```

A4 is a read-only bridge between the already implemented Action Lab angular readout and frozen continuous-substrate states. It does not change the V5/V6/V14 dynamics and cannot promote an Action Lab moment into physical force.

## Lineage

A4 continues the existing method ladder without replacing it:

```text
A0
  distributed volume <-> receiver-centred angular column

A0.2
  isotropic incident / straight / deficit / residual ledgers

A0.3
  direct-labelled and background-labelled inverse-square branches;
  finite root absent when their coefficient ratio is constant

A1
  extended receiver integration

A2 / A2B
  overlap amount ledger and free-boundary geometry blocker

D0S
  static positive equal-microbody representation parity

A3
  first formed-domain owner + complete uniform-q chord;
  W0 / W1 / W2

A4
  source-exported non-negative rho(x);
  real K2 integral rho(s) ds;
  transparent and first-owner comparison lanes;
  W0 / W1 / W2 / P1-P4 / curl diagnostics
```

A4 is therefore not a new interaction law. It is the missing data and readout bridge from a continuous state to an already established angular action ledger.

## Current authority boundary

The branch contains synthetic method oracles but no frozen V5, V6 or V14 density packet. The only permitted current project-level verdict is:

```text
A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER
```

Synthetic fixtures may pass representation and integration gates. They may not be cited as V14 evidence.

## Frozen snapshot contract

```ts
interface ContinuousFieldSnapshotV1 {
  schema: "VOXELLAB_CONTINUOUS_FIELD_SNAPSHOT_V1";
  snapshotId: string;
  sourceClass:
    | "SYNTHETIC_ORACLE"
    | "FROZEN_V5"
    | "FROZEN_V6"
    | "FROZEN_V14";

  // Physical coordinate of rho[0,0,0].
  origin: [number, number, number];

  // Positive cell-centre spacing.
  spacing: [number, number, number];

  // nx, ny, nz; every axis >= 2.
  dimensions: [number, number, number];

  // Flat x-fastest cell-centred non-negative density array.
  rho: number[];

  // Optional source-solver domain ownership.
  // 0 = no registered formed-domain owner; positive integers = source IDs.
  ownerIds?: number[];

  provenance: {
    sourceCommit: string;
    sourcePacketSha256: string | null;
    claimCeiling: string;
  };
}
```

Frozen source classes require:

```text
complete 40-character source commit;
complete 64-character source packet SHA256;
finite origin;
strictly positive spacing;
integer dimensions;
rho.length = nx*ny*nz;
rho_i >= 0;
ownerIds.length = nx*ny*nz when supplied;
ownerIds_i integer and >= 0.
```

The browser rejects a malformed packet. Missing arrays are not reconstructed from pixels, scene geometry or project memory.

## Coordinate and interpolation semantics

The array is x-fastest:

```text
index = ix + nx*(iy + ny*iz)
```

`rho(x)` uses trilinear interpolation of the cell-centred positive samples. The optional owner readout uses the density-weighted dominant owner, including owner `0`, among the eight trilinear neighbours. This avoids creating an ownerless interpolation skin around a valid single-owner body whose exterior density is zero, while preventing a weak interpolated owner contribution from overriding a positive owner-0 background.

No owner is inferred from a density threshold when `ownerIds` are absent.

## K2 continuous-column operator

For a receiver at `x` and equal-solid-angle direction `Omega`, A4 intersects the registered snapshot box and performs midpoint line integration:

```text
Sigma(x,Omega) = integral rho(x+s*Omega) ds
dA(x,Omega)    = Sigma(x,Omega) dOmega
```

The angular moments are:

```text
W0(x) = sum dA

W1(x) = sum Omega dA

W2(x) = sum outer(Omega,Omega) dA
```

Because `|Omega|=1`:

```text
trace(W2) = W0
```

A4 records the absolute and relative trace-closure residual.

The operator is the receiver-centred identity corresponding to:

```text
integral rho(y) dV / |y-x|^2
```

It does not insert an additional fitted `1/r^2` force law.

## Projection lanes

### T0 — transparent full column

```text
TRANSPARENT_FULL_COLUMN
```

Every positive `rho` sample along the ray contributes. This is the no-screening method limit.

### T1 — first registered owner

```text
FIRST_REGISTERED_OWNER_COLUMN
```

The first positive source-exported owner encountered along the ray is selected. Only samples belonging to that owner contribute to the K2 column. This lane requires `ownerIds`.

T1 is the continuous-grid counterpart of the A3 first-owner method control. It is not automatically the final BGF opacity law.

### Signed comparison

```text
transparent full column - first registered owner
```

is exported as:

```text
SIGNED_READOUT_DIFFERENCE_NOT_NEGATIVE_MATTER
```

It is not negative density, not a post-hit routing kernel and not physical attenuation.

## Angular diagnostics

A4 reports:

```text
W0;
W1 vector and magnitude;
full W2 tensor;
normalized deviatoric W2 norm;
real weighted angular multipole powers P1-P4;
coverage fraction;
open direction count;
first-owner direction inventory.
```

`P1-P4` are normalized powers of the positive angular action map. They are suitable for refinement, rotation and pre-split ordering tests, but they are not new ontological primitives.

## Curl diagnostic

A4 can evaluate the same readout at six neighbouring receivers and estimate:

```text
curl W1
```

by centred finite differences. It records:

```text
raw curl vector;
curl magnitude;
normalized curl = |curl|*delta / mean_neighbour_|W1|.
```

A small curl is a necessary numerical compatibility check before comparing the readout to `-grad(mu)`. It is not sufficient proof that the physical force is potential-derived.

## Measured-dynamics comparison

The bridge supplies a coefficient-free comparison helper between an A4 `W1` and a source-exported reference vector:

```text
cosine alignment;
best scalar coefficient;
relative residual after the best single scalar coefficient.
```

This allows a later V5/V6 packet to test whether one constant conversion factor can map the readout to the measured dynamic response. It does not bind cadence or physical units.

## Synthetic method fixtures

### Uniform sphere

A positive continuous sphere is represented on a cell-centred grid with eight-point fractional boundary occupancy. A4 compares the transparent K2 readout against the independent analytic A0 uniform-sphere oracle.

### Two-owner column

Two disjoint positive formed domains have overlapping angular support from the receiver. It verifies that:

```text
transparent full column
>
first-owner column
```

when a farther owner is hidden in part of the angular map.

Neither fixture is a V14 state.

## Preregistered method gate

The CI method gate uses:

```text
uniform sphere resolution = 41^3;
direction count = 32768;
midpoint step length = 0.45*minimum grid spacing.
```

Registered checks:

```text
G01 transparent W0 analytic relative error <= 0.06
G02 transparent W1 analytic relative error <= 0.06
G03 one-owner transparent/first-owner W0 delta <= 1e-12
G04 one-owner transparent/first-owner W1 delta <= 1e-12
G05 rotation W0 covariance delta <= 0.06
G06 rotation W1 covariance delta <= 0.06
G07 trace(W2)=W0 relative residual <= 1e-12
G08 synthetic radial-field normalized curl <= 0.35
```

A method PASS opens only the frozen-snapshot export gate.

## Browser panel

The A4 panel provides:

```text
synthetic uniform-sphere and two-owner controls;
strict JSON snapshot loader;
transparent / first-owner switch;
receiver coordinates;
angular direction refinement;
rho X-Z slice;
K2 angular map;
W0 / W1 / W2;
P1-P4;
projection comparison;
analytic sphere parity;
bounded JSON receipt export.
```

The panel never uploads the selected file to a server. It parses it locally in the browser and performs a read-only computation.

## Required source export to leave the current blocker

At minimum, a source-solver packet must contain:

```text
one frozen rho snapshot;
the exact grid coordinate convention;
source commit;
packet SHA256;
claim ceiling;
receiver/readout locations frozen before A4 evaluation.
```

For the planned physical programme it must additionally contain:

```text
V5 corridor snapshots and measured dynamic response;
V6 holdout snapshots;
V14 pre-formation, formed and post-formation snapshots;
V14C pre-split and split-neighbour snapshots;
mu when the curl/gradient comparison is requested;
ownerIds only when ownership is a genuine solver output.
```

Core, cavity and contour labels must remain source outputs or diagnostics. A4 must not prescribe their radius or shape.

## Firewalls

```text
READ_ONLY_NO_FEEDBACK_INTO_DYNAMICS
NO_SYNTHETIC_FIXTURE_AS_V14_EVIDENCE
NO_OWNER_IDS_INFERRED_WHEN_NOT_EXPORTED
NO_FIRST_OWNER_AS_FINAL_OPACITY_LAW
NO_TRANSPARENCY_FIT_TO_TARGET_ROOT
NO_A0_3_RERADIATION_AS_VIKTOR_CANON
NO_PRESCRIBED_CAVITY_RADIUS
NO_W1_AS_PHYSICAL_FORCE_BEFORE_DYNAMIC_PARITY
NO_PHYSICAL_CADENCE
NO_UPOR_CLAIM
NO_DIPOLE_VALIDATION
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
