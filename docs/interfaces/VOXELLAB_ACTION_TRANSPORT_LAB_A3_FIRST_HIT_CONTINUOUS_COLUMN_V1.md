# VoxelLab Action Transport Lab A3 — First-hit continuous column

## Status

```text
FIRST_HIT_CONTINUOUS_COLUMN_BROWSER_METHOD_CONTROL
```

A3 is a public engineering/method visualization. It is not a physical validation result and does not promote first-hit, WQN, Upor, dipole, scale or any constitutive field law.

## Semantic repair represented

```text
FIELD AS A WHOLE
  externally continuous;
  internally continuous.

FORMED CLUMP DOMAIN
  external force-relevant contour / separatrix;
  internally continuous content.

FIRST HIT
  first contour entry;
  angular owner selection;
  not reflection, absorption, scattering or re-emission.

ENTRY -> EXIT
  one continuous owner column;
  internal voxels/samples are not separate hits.
```

## Browser operator

For each equal-solid-angle direction `Omega` from the receiver:

1. intersect all registered formed-clump sphere fixtures;
2. choose the owner with the smallest positive entry distance;
3. retain that owner's complete entry/exit chord `H(Omega)`;
4. assign positive column amount

```text
dN_Omega = q_owner * H(Omega) * dOmega
```

5. count that owner exactly once;
6. accumulate

```text
W0 = sum dN_Omega
W1 = sum direction * dN_Omega
W2 = sum outer(direction,direction) * dN_Omega
```

No behind-owner intersection is counted at this level. No outgoing routing kernel exists in A3.

## Display lanes

```text
K0 BINARY OWNERSHIP
  first owner + dOmega only;
  historical silhouette control.

K1 CONTINUOUS COLUMN
  first owner + H(Omega) + positive q;
  active A3 browser method.

K2 q(s) COLUMN
  intended generalization to positive integral int q(s) ds;
  A3 fixtures currently use uniform q per owner.

K3 SOURCE-REDUCED hSq PARITY
  one-sphere comparison against analytic volume and R13 CURVED_H_OMEGA.
```

## Independent one-sphere oracle

The first clump is also evaluated alone through:

```text
ANALYTIC VOLUME ORACLE
R13 CURVED_H_OMEGA Gauss integration
A3 FIRST-OWNER FIBONACCI COLUMN
```

This tests representation parity, not physical truth.

## Fixtures

### Single sphere oracle

One uniform formed sphere. Used for analytic and curved-column parity.

### Two-clump angular overlap

Two non-overlapping 3D sphere fixtures with overlapping angular silhouettes. The first entry selects the owner and the full chord of that owner is counted.

### Three-clump owner competition

Three separated formed domains used to expose the angular owner partition and column-weight map.

## Firewalls

```text
NO_VOXEL_AS_FIELD_PARTICLE
NO_HARD_SPHERE_ONTOLOGY
NO_POST_HIT_ROUTING_KERNEL
NO_FIRST_HIT_PHYSICAL_VALIDATION
NO_WQN_SOURCE_PROMOTION
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_DIPOLE_CLAIM
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
