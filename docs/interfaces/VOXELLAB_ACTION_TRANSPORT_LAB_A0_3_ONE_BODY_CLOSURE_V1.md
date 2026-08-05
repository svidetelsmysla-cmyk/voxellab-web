# VoxelLab Action Transport Lab A0.3 — one-body source/screen closure

## Purpose

A0.3 adds an exact radial audit for one uniform sphere and keeps two roles separate:

```text
BODY AS SOURCE:
  positive body-delivered action from the sphere amount;

BODY AS SCREEN:
  positive deficit and residual created in an isotropic background by the sphere silhouette.
```

The panel does not identify the field as an independent source. It treats bodies as the source-labelled objects and the common field as the carrier/superposed directional action map.

## Exact body quantities

For a uniform sphere radius `R`, amount density `q`, and receiver distance `r`:

```text
W0_body(r) = integral_V q dV / |x-y|^2
```

The exact closed form implemented for `r != R` is:

```text
W0_body = 2*pi*q * [
  R + (R^2-r^2)/(2r) * log((r+R)/abs(r-R))
]
```

with exact limits:

```text
W0_body(0) = 4*pi*q*R
W0_body(R) = 2*pi*q*R
```

The exact directional first moment is:

```text
r <= R:
  |W1_body| = (4*pi/3)*q*r

r >= R:
  |W1_body| = q*V/r^2
```

## Exact exterior background quantities

For positive isotropic incident intensity `I` per steradian:

```text
r >= R:
  W0_incident = 4*pi*I
  W0_deficit = 2*pi*I*(1-sqrt(1-(R/r)^2))
  W0_straight = W0_incident-W0_deficit
  |W1_background_residual| = pi*I*(R/r)^2
```

No background-screen value is invented for `r < R`; the A0.2 background fixture remains exterior-only.

## Conditional closed-system derivation

A0.3 visibly separates source-derived claims from the added closure assumptions.

Additional assumptions:

```text
full acceptance by a spherical body;
stationary local balance;
no action destruction or storage;
isotropic outgoing redistribution over 4*pi.
```

Then:

```text
A_in = 4*pi*R^2 * integral_hemisphere I*cos(theta)dOmega
     = 4*pi*R^2 * pi*I
     = 4*pi^2*I*R^2

S_out = A_in/(4*pi)
      = pi*I*R^2
```

Therefore:

```text
|W1_direct_out| = pi*I*R^2/r^2
|W1_background_residual| = pi*I*R^2/r^2
```

The magnitudes coincide for every exterior radius. In the complex-repulsion reading the physical orientations are opposite:

```text
direct body-associated branch = radially outward;
external-background residual = radially toward the body.
```

This is a conditional logical closure. It is not source-canon proof that every body reradiates isotropically.

## Interactive coefficient ratio

The panel exposes:

```text
kappa = direct source coefficient / matched background coefficient.
```

Exterior signed net:

```text
W1_net = (kappa-1)*pi*I*R^2/r^2.
```

Consequences:

```text
kappa = 1:
  exact cancellation at every exterior radius;

kappa < 1:
  external-background branch dominates at every exterior radius;

kappa > 1:
  direct body branch dominates at every exterior radius.
```

Two constant-coefficient inverse-square branches do not select a unique finite equilibrium radius.

## Visual channels

Scalar plot:

```text
W0_body;
W0_incident;
W0_straight;
W0_deficit.
```

Directional plot:

```text
direct body outgoing branch;
external-background residual branch;
signed net;
exact body interior/exterior W1 reference.
```

The body interior is shaded and the body surface `r=R` is marked. Background curves are absent inside the body rather than extended with a fitted spline.

## Verdict

```text
A0_3_ONE_BODY_SOURCE_SCREEN_RADIAL_CLOSURE_PASS
```

Scientific result:

```text
FINITE_EQUILIBRIUM_NOT_PRESENT
for the frozen one-body, constant-coefficient, exterior inverse-square closure.
```

This is a useful non-failure result. A finite restoring boundary requires a ratio-changing mechanism in a later gate.

## Firewalls

```text
NO_LIGHT_IDENTITY_CLAIM
NO_FIELD_AS_INDEPENDENT_SOURCE_CLAIM
NO_LOCAL_RERADIATION_AS_SOURCE_CANON
NO_OPAQUE_LIMIT_AUTO_PROMOTION
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_SCALE_BINDING
NO_GRIN_PHYSICAL_LAW
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
