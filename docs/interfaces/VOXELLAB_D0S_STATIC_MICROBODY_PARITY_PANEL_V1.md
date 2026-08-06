# VoxelLab D0S static equal-microbody parity panel V1

## Purpose

D0S tests a source-explicit force-calculation replacement before any motion:

```text
one analytic uniform sphere
versus
same total positive amount distributed among equal fixed microbodies.
```

The panel is appended to `/action-lab/` after A2B. It does not modify the older
A0.1–A2B contracts.

## Representation

```text
N48   / 3 radial strata;
N192  / 5 radial strata;
N768  / 8 radial strata;
N3072 / 12 radial strata.
```

Each microbody carries exactly:

```text
N_i = q*(4*pi*R^3/3)/N.
```

The construction uses:

```text
positive equal weights;
cumulative equal-volume radial strata;
midpoint radius in r^3;
antipodal angular pairs;
deterministic shell rotations;
amount-weighted COM recentering.
```

The finite set is always labelled a representation/refinement control. It is
not labelled an exact continuous sphere.

## Operators

Analytic route:

```text
existing A0 exact uniform-sphere exterior W0/W1 oracle.
```

Discrete route:

```text
W0 = sum_i N_i/|x_i-p|^2;
W1 = sum_i N_i*(x_i-p)/|x_i-p|^3.
```

No existing rigid `voxel_elements` are reused as mobile bodies. D0S contains no
motion at all.

## Probe corridor

```text
r/R = 1.2, 1.5, 2, 3, 5, 8;
```

in seven frozen directions:

```text
+X, +Y, +Z,
normalize(1,1,1),
normalize(1,-1,1),
normalize(2,1,-1),
normalize(-1,2,1).
```

## Independent controls

```text
amount closure;
COM closure;
equal-weight closure;
particle-order reversal and deterministic permutation;
simultaneous global rotation covariance;
fixed-radius orientation spread;
N refinement;
real spherical-harmonic multipole powers l=1..4.
```

The angular basis is implemented with real sine/cosine channels. No complex
ontology or imaginary primitive is used.

## Interface

The panel shows:

```text
selected refinement and shell counts;
XY microbody projection;
selected-level numerical ledger;
worst registered probe;
log-scale refinement graph;
N48–N3072 table;
G01–G17 gate table;
real P1–P4 multipole table;
D0M open/closed status;
JSON receipt export.
```

Display decimation at N3072 affects only the canvas. All microbodies participate
in W0/W1 computation.

## Verdict ceiling

A passing panel may establish only:

```text
STATIC_EQUAL_MICROBODY_REPRESENTATION_METHOD_PARITY.
```

It may open the separate D0M implementation gate. It does not establish:

```text
a self-held clump;
dynamic spherical preservation;
contact behaviour;
Upor;
physical force or cadence;
scale binding;
dipole stability;
validation or canon promotion.
```

## Firewalls

```text
NO_DYNAMICS_IN_D0S
NO_VOXEL_ELEMENT_AS_MOBILE_BODY_CLAIM
NO_FINITE_SET_AS_EXACT_SO3_SPHERE
NO_TOLERANCE_FITTING
NO_BACKGROUND_OR_REDIRECTION_IN_D0S
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_DIPOLE_VALIDATION
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
