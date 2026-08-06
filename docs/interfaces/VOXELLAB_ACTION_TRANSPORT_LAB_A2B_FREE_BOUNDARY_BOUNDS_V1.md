# VoxelLab Action Transport Lab A2B — free-boundary geometry lower bounds V1

## Mission

Interpret the exact A2 overlap lens at the correct physical level.

The overlap of two undeformed reference spheres is not treated as a place where
two saturated clump amounts coexist. It is treated as an exact geometric demand:
that amount-volume must leave the conflict zone if two distinct, connected and
non-overlapping clump identities are retained.

## Frozen branch

```text
B1_DISTINCT_CLUMPS_FREE_BOUNDARY
```

```text
two centre labels;
two connected domains;
disjoint physical occupancy;
separate positive amount conservation;
equal-clump exchange symmetry;
no compression above the saturated ceiling;
no selected elasticity or force law.
```

Other branches are displayed but not mixed into B1:

```text
B2 merger / identity loss;
B3 shedding to the field ocean;
B4 submaximal compression.
```

## Exact analytic quantities

Equal reference spheres radius `R`, centre separation `d`, `y=d/R`:

```text
V = 4*pi*R^3/3;
V_overlap = pi*(4R+d)*(2R-d)^2/12;
f_overlap = V_overlap/V = (4+y)*(2-y)^2/16.
```

For the equal-clump B1 branch:

```text
displaced volume per clump = V_overlap/2;
displaced fraction per clump = f_overlap/2;
required total occupied volume outside the undeformed union >= V_overlap.
```

A geometry-only lower bound on maximum reach around either fixed centre is:

```text
R_out_min/R = (1+f_overlap/2)^(1/3);
delta_R_min/R = (1+f_overlap/2)^(1/3)-1.
```

This bound uses a complete spherical shell only as the maximum-capacity envelope.
It is not a solved contour and not a proposed physical shape. Any localized
bulge must reach at least as far.

## Exact reference values

```text
d/R = 2:
  f_overlap = 0;
  delta_R_min/R = 0.

d/R = 1.2:
  f_overlap = 0.208;
  displaced fraction per clump = 0.104;
  delta_R_min/R = 0.03352985047272461.

d/R = 1:
  f_overlap = 0.3125;
  displaced fraction per clump = 0.15625;
  delta_R_min/R = 0.04958411345210201.

d/R = sqrt(3)-1:
  f_overlap = 0.475480947161671;
  displaced fraction per clump = 0.2377404735808355;
  delta_R_min/R = 0.07368412234712274.

d/R = 0:
  f_overlap = 1;
  displaced fraction per clump = 0.5;
  delta_R_min/R = (3/2)^(1/3)-1 = 0.14471424255333187;
  B1 distinct-centre topology is blocked.
```

## Independent routes

```text
M0 exact equal-sphere lens formula;
M1 deterministic Gauss integration of the reference overlap cross-sections;
M2 exact equal split and total amount ledgers.
```

## Interface semantics

```text
solid blue/green circles = undeformed reference profiles;
red lens = must-leave conflict volume;
yellow/green dashed circles = minimum full-shell capacity envelopes;
no displayed dashed envelope is a solved clump boundary.
```

The panel provides:

```text
interactive d/R;
contact, A2 default, A2 control peak and concentric presets;
conflict-volume map;
per-clump displacement ledger;
minimum reach bounds;
corridor plots;
branch table;
reference-value table;
M0/M1/M2 parity;
JSON receipt export.
```

## Verdict ceiling

A2B may establish:

```text
exact displacement demand;
positive amount conservation;
minimum geometry-only reach bound;
termination of the two-distinct-centre branch at coincident centres;
need for a constitutive free-boundary law.
```

A2B does not establish:

```text
actual deformed contour;
side/rear/cavity redistribution;
elastic energy or stiffness;
resultant W1;
torque;
physical force;
upor;
dipole stability;
scale or validation.
```

Expected bounded verdict:

```text
A2B_FREE_BOUNDARY_GEOMETRY_LOWER_BOUNDS_PASS_CONSTITUTIVE_LAW_BLOCKER
```

## Firewalls

```text
NO_SHARED_PHYSICAL_DOUBLE_OCCUPANCY
NO_ARBITRARY_COMPENSATION_SOURCE
NO_RIGID_SPHERE_AS_PHYSICAL_CLUMP_BOUNDARY
NO_DEFORMED_CONTOUR_AS_SOLVED
NO_TARGET_EQUILIBRIUM_FITTING
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_DIPOLE_VALIDATION
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
