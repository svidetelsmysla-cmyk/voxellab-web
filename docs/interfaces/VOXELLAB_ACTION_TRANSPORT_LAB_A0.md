# VoxelLab Action Transport Lab A0

## Public route

```text
/voxellab-web/action-lab/
```

This is a separate research interface. The existing Scene Lab S01–S17 remains
available at the repository root.

## Frozen fixture

```text
formed uniform sphere;
exterior receiver probe;
straight routes only;
positive amount density q;
no GRIN;
no optical BRDF/IOR;
no absorption;
no physical cadence;
no dynamics.
```

## Display quantities

```text
W0 = integral_V q dV / r^2
   = integral_S2 H_q(Omega) dOmega

W1 = integral_V q r_hat dV / r^2
```

The heatmap normalizes either W0 or |W1| by its exterior surface value for
display only. The raw values remain visible in the probe table and exported
receipt.

W0 is a positive scalar delivered-action column. W1 is the first directional
moment of the same distributed map. Neither is field density or physical
force.

## Independent routes

```text
ANALYTIC_ORACLE
  closed-form exterior uniform sphere;

DISTRIBUTED_VOLUME
  16 radial equal-volume shells x 1024 Fibonacci directions;

CURVED_H_OMEGA
  receiver-centred curved footprint,
  exact chord H(Omega),
  96-point Gauss-Legendre polar integration;

RENDERER_RAYS
  deterministic Hammersley importance samples over the exact visible cap,
  exact ray/sphere intervals.
```

## Frozen A0 corridor

```text
r/R = 1.05, 1.10, 1.20, 1.50, 2, 3, 5, 8
```

Thresholds:

```text
volume cubature maximum relative error <= 2e-3;
curved H(Omega) maximum relative error <= 2e-5;
renderer-ray maximum relative error <= 2e-4;
analytic exterior W1 far-law residual <= 1e-12.
```

Target interface verdict:

```text
STRAIGHT_ROUTE_SPATIAL_ACTION_RENDERER_PARITY_PASS
```

## Firewalls

```text
NO_FIELD_DENSITY_CLAIM
NO_PHYSICAL_FORCE
NO_CADENCE_BINDING
NO_SCALE_BINDING
NO_GRIN_PHYSICAL_LAW
NO_VALIDATION
NO_CANON_PROMOTION
```
