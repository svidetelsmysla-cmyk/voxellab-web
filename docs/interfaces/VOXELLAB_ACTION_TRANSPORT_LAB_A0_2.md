# VoxelLab Action Transport Lab A0.2

## Public route

```text
/voxellab-web/action-lab/
```

A0.2 extends A0.1 without changing the A0.1 quantity contract.

## Two distinct map families

```text
A0.1 BODY -> PROBE
  W0 = positive scalar action delivered by the full formed-body volume;
  W1 = first directional moment of that body-delivered map;
  thickness H(Omega) participates.

A0.2 ISOTROPIC SKY -> BODY SILHOUETTE -> PROBE
  incident = positive common isotropic background;
  straight surviving = incident action not blocked by the silhouette;
  straight deficit = positive action removed from the straight channel;
  residual = directional surviving moment after antipodal cancellation is broken.
```

The two families may have related geometry but are not renamed into one another.

## A0.2 analytic sphere control

For an exterior receiver at distance r from a formed sphere of radius R:

```text
sin(alpha) = R/r
Omega_body = 2*pi*(1-cos(alpha))

W0_incident = 4*pi*I
W0_deficit = I*Omega_body
W0_straight = W0_incident-W0_deficit

|W1_residual| = pi*I*(R/r)^2
```

All scalar channels are positive. Vector opposition is carried only by orientation.

## Independent A0.2 routes

```text
ANALYTIC_CAP
CURVED_CAP_GAUSS96
RENDERER_BROAD_CONE_HAMMERSLEY_EXACT_FIRST_HIT
```

## Interface channels

```text
BG_DEFICIT
BG_STRAIGHT
BG_RESULTANT
BODY_W0
BODY_W1
```

## Frozen tolerances

```text
curved cap scalar/vector error <= 2e-10
renderer first-hit scalar/vector error <= 5e-4
scalar closure <= 1e-12
vector closure <= 1e-12
analytic residual 1/r^2 error <= 1e-12
inherited A0.1 error <= 2e-4
```

## Interpretation ceiling

The opaque first-hit silhouette is a geometry control, not a selected final opacity law for BGF.

```text
NO_LIGHT_IDENTITY_CLAIM
NO_OPAQUE_LIMIT_AUTO_PROMOTION
NO_FIELD_DENSITY_CLAIM
NO_PHYSICAL_FORCE
NO_CADENCE_BINDING
NO_SCALE_BINDING
NO_GRIN_PHYSICAL_LAW
NO_LUXCORE_OPERATOR_IMPORT
NO_VALIDATION
NO_CANON_PROMOTION
```
