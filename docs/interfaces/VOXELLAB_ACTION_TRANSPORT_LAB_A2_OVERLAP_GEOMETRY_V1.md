# VoxelLab Action Transport Lab A2 — overlap geometry V1

## Mission

Replace the historical fitted overlap spline with an explicit equal-sphere contact/overlap calculation while preserving the project rule that one physical occupied volume must not be counted twice.

## Frozen fixture

```text
source sphere radius R;
receiver sphere radius R;
centre separation 0 <= d <= 2.5R;
matched kappa = 1;
positive uniform receiver amount density;
straight direct channel;
opaque first-hit only for the external-background channel;
no redirection;
no GRIN;
no contact force;
no dynamics;
no physical cadence.
```

## Exact geometric ledger

For `0 <= d < 2R`:

```text
V_overlap = pi*(4R+d)*(2R-d)^2/12;
M_overlap,x = (d/2)*V_overlap.
```

The equal-sphere lens is symmetric about `x=d/2`.

Amount preservation is represented as:

```text
V_union = 2V_sphere - V_overlap;
V_compensation = V_overlap;
V_union + V_compensation = 2V_sphere.
```

`V_compensation` is a positive amount ledger. A2 does not invent where this amount is placed.

## Local channel control

Matched direct/background branches outside the source cancel pointwise. Under the binary opaque first-hit limiting control:

```text
outside source:
  a_direct = +C*x/r^3;
  a_background = -C*x/r^3;

inside source:
  a_direct = +C*x/R^3;
  a_background = 0.
```

Thus a naive dual-membership receiver, which continues to treat the shared lens as receiver material, obtains:

```text
W1_dual = C*qr*M_overlap,x/R^3.
```

Normalized to the exterior contact reference:

```text
x = d/(2R);
G_dual(x) = 2x(2+x)(1-x)^2,
0 <= x <= 1.
```

The exact maximum is:

```text
d/R = sqrt(3)-1 = 0.7320508075688772...;
G_max = -9/2 + 3sqrt(3) = 0.6961524227066319....
```

No fitted coefficient and no cubic overlap spline are used.

## Governance split

### Lane 1 — dual-membership control

```text
shared occupied volume participates as source and receiver simultaneously;
result is calculable;
result is diagnostic only;
not a physical upor result.
```

### Lane 2 — unified occupied domain

```text
shared volume is counted once;
receiver-exclusive region retains matched pointwise cancellation;
resolved exclusive resultant = 0;
shared ownership is not assigned;
compensation amount is exported but not spatially placed;
full two-body result = OVERLAP_COMPENSATION_PLACEMENT_BLOCKER.
```

This implements the project constraint that double occupancy must be replaced by a unified occupied domain plus a compensation amount equal to the excess overlap.

## Independent routes

```text
M0 exact lens volume and first-moment oracle;
M1 source-centred curved-shell Gauss integration;
M2 deterministic 3D equal-volume receiver cubature.
```

## Interface

The A2 panel provides:

```text
source/receiver/shared-domain cross-section;
membership, direct, background and dual-net maps;
exact directional curves versus d/R;
overlap and compensation fraction curves;
amount closure ledger;
M0/M1/M2 parity table;
concentric, exact-peak, contact and separated presets;
JSON receipt export.
```

## Interpretation ceiling

A2 may establish:

```text
exact overlap geometry;
exact dual-membership control curve;
positive amount closure through union + compensation;
location of the old overlap question in shared ownership / compensation placement.
```

A2 does not establish:

```text
physical interpenetration law;
contact force;
upor;
location of the compensation amount;
redirection law;
physical force cadence;
scale;
validation;
canon promotion.
```

## Firewalls

```text
DUAL_MEMBERSHIP_CONTROL_NOT_PHYSICAL_UPOR
NO_DOUBLE_OCCUPANCY_AS_PHYSICAL_AMOUNT
NO_COMPENSATION_PLACEMENT_INVENTED
NO_OPAQUE_LIMIT_AUTO_PROMOTION
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
