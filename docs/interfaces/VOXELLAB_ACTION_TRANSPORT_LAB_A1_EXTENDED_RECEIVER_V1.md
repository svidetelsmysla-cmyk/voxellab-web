# VoxelLab Action Transport Lab A1 — extended receiver V1

## Purpose

A1 replaces the point probe of A0.3 with a second uniform spherical receiver and keeps the distributed local map separate from integrated W0, resultant W1 and torque.

## Frozen domain

```text
source sphere radius Rs at origin;
receiver sphere radius Rr at centre separation d;
d >= Rs + Rr;
contact permitted;
overlap prohibited;
straight routes;
common receiver participation;
no partial opacity;
no redirection;
no GRIN;
no cadence.
```

## Matched local branches

```text
C = pi*I*Rs^2;

a_direct(x) = +kappa*C*x/|x|^3;
a_background(x) = -C*x/|x|^3.
```

For `kappa=1`, the two directional branches cancel pointwise at every receiver element before any centre-of-mass reduction.

## Extended receiver readout

```text
W0_body_receiver = integral_receiver qr*W0_body(x)dV;
W0_deficit_receiver = integral_receiver qr*W0_deficit(x)dV;
W1_receiver = integral_receiver qr*a(x)dV;
torque = integral_receiver (x-Xr) cross qr*a(x)dV.
```

## Independent routes

### M0 analytic shell-theorem oracle

For either central inverse-square branch:

```text
|W1_receiver| = C*Nr/d^2,
Nr = qr*(4*pi/3)*Rr^3.
```

### M1 source-centred curved-shell Gauss integral

For a radial scalar `f(r)`:

```text
integral_receiver f(r)dV
 = (pi/d) integral_[d-Rr,d+Rr]
   r*[Rr^2-(r-d)^2]*f(r)dr.
```

For a radial vector magnitude `g(r)`, the axial component uses the exact spherical-cap first moment.

### M2 three-dimensional equal-volume cubature

The receiver is sampled by deterministic equal-volume radial shells and Fibonacci angular directions. Local source/background vectors and local torque contributions are accumulated without point reduction.

## Display

A1 provides:

```text
source/receiver cross-section;
receiver-local direct/background/net map and arrows;
receiver-local W0 difference map;
integrated W0 curves versus surface gap;
integrated W1 curves versus gap;
readout table;
M0/M1/M2 parity table;
JSON receipt.
```

## Frozen acceptance thresholds

```text
M1 W1 relative error <= 1e-11;
M2 W1 relative error <= 1e-5;
M2 W0 relative error <= 1e-4;
normalized torque <= 1e-5.
```

## Interpretation ceiling

A1 can determine whether spherical receiver extension alone changes the ratio of the two frozen exterior branches. It cannot validate physical force, upor, partial opacity, redirection, overlap physics, GRIN, scale or cadence.
