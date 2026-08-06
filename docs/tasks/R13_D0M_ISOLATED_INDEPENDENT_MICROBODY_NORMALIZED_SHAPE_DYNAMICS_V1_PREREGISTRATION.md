# R13 D0M isolated independent-microbody normalized-shape dynamics V1 — preregistration

## Mission

Run one isolated equal-positive-microbody cluster under the unmodified direct
positive central pair branch and test normalized spherical-shape preservation
during free expansion.

D0S passed the static representation gate. D0M does not introduce contact,
Upor, damping, softening, cutoff, force cap, background screening, redirection,
shape restoration or physical time.

## Independent state contract

Every microbody has a stable id and independently integrated:

```text
amount fraction mu_i > 0;
position x_i;
velocity u_i;
acceleration a_i.
```

No shared parent transform or rigid local offset is allowed. Typed arrays are
allowed only as storage for independent states.

## Frozen normalized operator

```text
R_reference = 1;
sum_i mu_i = 1;
C = 1;
tau = t/sqrt(R^3/(C*N_total));

d²x_i/dtau² = sum_(j != i) mu_j*(x_i-x_j)/|x_i-x_j|^3.
```

Use paired action-reaction evaluation and symplectic Euler:

```text
u(n+1) = u(n) + a(n)*Delta_tau;
x(n+1) = x(n) + u(n+1)*Delta_tau.
```

No softening, damping, cutoff, clipping or contact term.

## Frozen refinement family

```text
N24  / 3 radial strata;
N48  / 3 radial strata;
N96  / 4 radial strata;
N192 / 5 radial strata.
```

Initial positions use the D0S equal-volume antipodal-shell construction.

```text
mu_i = 1/N;
COM(0)=0;
u_i(0)=0;
linear momentum = 0;
angular momentum = 0.
```

## Frozen time and milestones

```text
primary Delta_tau = 0.001;
tau_max = 3.0;
steps_max = 3000;
```

Record the first completed step crossing:

```text
R_rms/R_rms0 = 1.10, 1.25, 1.50.
```

No interpolation for verdict states.

Time refinement at N96:

```text
Delta_tau = 0.004, 0.002, 0.001.
```

## Registered observables

```text
COM and R_rms;
normalized shape tensor eigenvalues;
anisotropy A;
best homologous radial rate h;
homology residual H;
tangential kinetic fraction T;
outward amount fraction;
real P1-P4 angular powers;
minimum pair ratio;
kinetic, repulsive potential and total energy;
linear and angular momentum residuals;
nonfinite/singular event count.
```

Definitions:

```text
y_i=(x_i-COM)/R_rms;
S=sum_i mu_i*y_i*y_i^T;
A=sqrt((3/2)*sum_k(lambda_k-1/3)^2);

h=sum_i mu_i*u_i dot r_i / sum_i mu_i*|r_i|²;
H=sqrt(sum_i mu_i*|u_i-h*r_i|² / sum_i mu_i*|u_i|²);

T=sum_i mu_i*|u_i-(u_i dot rhat_i)rhat_i|²
  /sum_i mu_i*|u_i|².
```

## Covariance controls

At N96 and `Delta_tau=0.001`:

```text
frozen global axis-angle rotation;
frozen deterministic particle permutation;
stable-id state comparison after inverse transform/order restoration.
```

## Frozen gates

```text
G01 all registered runs finite and reach expansion 1.50 before tau=3;
G02 amount closure <= 1e-15;
G03 COM drift/R_rms0 <= 1e-11;
G04 normalized linear momentum <= 1e-11;
G05 normalized angular momentum <= 1e-10;
G06 N192 energy drift at 1.50 <= 5e-3;
G07 minimum pair ratio >= 0.75 and singular count = 0;
G08 N192 outward amount fraction >= 0.95 at all milestones;
G09 N192 max anisotropy drift <= 0.05;
G10 N192 T at 1.50 <= 0.08;
G11 N192 H at 1.50 <= 0.12;
G12 N192 P2 and P4 growth ratios <= 1.5;
G13 N192 A-drift, T and H each lower than N24 at 1.50;
G14 rotation state RMS <= 1e-8 and scalar delta <= 1e-9;
G15 permutation state RMS <= 1e-8 and scalar delta <= 1e-9;
G16 N96 dt 0.002-vs-0.001 A/T/H deltas <= 0.01 and
    energy drift at 0.001 lower than at 0.004;
G17 every primary milestone overshoot <= 0.005;
G18 source audit confirms no forbidden operator additions.
```

No threshold may change after implementation output is inspected.

## Verdict

```text
D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS;
D0M_PACKING_ANISOTROPY_REFINEMENT_BLOCKER;
D0M_TIME_INTEGRATION_OR_SINGULARITY_BLOCKER;
D0M_MOTION_BRIDGE_PROVENANCE_BLOCKER.
```

D0C opens only after D0M PASS.

## Firewalls

```text
NO_RIGID_PARENT_MICROBODY_MOTION
NO_SOFTENING_OR_FORCE_CAP
NO_DAMPING
NO_CONTACT_OR_UPOR_IN_D0M
NO_SHAPE_TARGET
NO_INTERPOLATED_VERDICT_STATE
NO_TOLERANCE_FITTING
NO_DIRECT_PAIRWISE_CONTROL_AS_FULL_VIKTOR_LAW
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_DIPOLE_VALIDATION
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
