# R13 D0S static microbody representation parity V1 — preregistration

## Mission

Compare the exact exterior action of one uniform sphere with the same total
positive amount distributed among equal fixed microbodies.

D0S is static. It does not open dynamics, contact, Upor, damping, background
screening, redirection, physical time or physical force.

## Frozen refinement family

```text
N48   / 3 radial strata;
N192  / 5 radial strata;
N768  / 8 radial strata;
N3072 / 12 radial strata.
```

All microbodies have equal positive amount. Shell boundaries are assigned from
cumulative equal-volume counts, shell radii use the midpoint in `r^3`, and each
shell uses antipodal angular pairs with deterministic shell rotations.

Finite point sets are refinement controls, not exact SO(3) spheres.

## Frozen probes

```text
r/R = 1.2, 1.5, 2, 3, 5, 8;
```

```text
+X, +Y, +Z,
normalize(1,1,1),
normalize(1,-1,1),
normalize(2,1,-1),
normalize(-1,2,1).
```

## Oracle and discrete route

```text
analytic W0/W1 = existing A0 exact uniform-sphere exterior oracle;

discrete W0 = sum_i N_i/|x_i-p|^2;
discrete W1 = sum_i N_i*(x_i-p)/|x_i-p|^3.
```

## Controls

```text
amount closure;
COM residual;
equal-weight residual;
particle-order reversal;
deterministic permutation;
simultaneous global rotation covariance;
fixed-radius orientation spread;
N refinement;
real spherical-harmonic powers l=1..4.
```

## Frozen finest-level thresholds

```text
max relative W0 error <= 2.5e-3;
max relative W1 magnitude error <= 2.5e-3;
max relative W1 vector error <= 3.0e-3;
max W0 orientation spread <= 3.0e-3;
max W1 orientation spread <= 3.0e-3;
COM residual/R <= 1e-14;
equal-weight spread/mean <= 1e-14;
permutation delta <= 1e-13;
rotation covariance delta <= 1e-12;
P1 <= 1e-12;
P2 <= 3.0e-3;
P3 <= 1e-12;
P4 <= 6.0e-3.
```

Refinement must reduce the maximum W1 vector error and maximum orientation
spread by more than a factor of 20 from N48 to N3072. P2 and P4 must decrease.

## Verdict

```text
D0S_STATIC_MICROBODY_REPRESENTATION_PARITY_PASS;
D0S_PACKING_OR_REFINEMENT_BLOCKER;
D0S_NUMERICAL_OR_PROVENANCE_BLOCKER.
```

D0M remains closed unless D0S passes.

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
