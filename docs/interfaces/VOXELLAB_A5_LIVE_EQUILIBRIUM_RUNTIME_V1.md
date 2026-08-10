# VoxelLab A5 — live equilibrium runtime V1

## Status

```text
LIVE_2D_REDUCED_EQUILIBRIUM_RUNTIME_IMPLEMENTED
NO_FROZEN_FRAME_PLAYBACK
NOT_3D_V14H_SOURCE_VALIDATION
NO_PHYSICAL_SCALE_OR_CADENCE_BINDING
NO_MERGE
```

A5 extends Action Lab after A4 with a real browser-side numerical runtime. The field evolves after the user presses PLAY or STEP; equilibrium maps are recomputed from the current state on the same step. A5 does not load a prerecorded V14 trajectory.

## Purpose

The live mode exists to expose the force/equilibrium topology without waiting for the material density to visibly split:

```text
current rho,w
  -> current material/action mu
  -> current source readout F=-grad(mu)
  -> current stiffness Hessian(mu)
  -> WELL / SADDLE / PEAK / NEUTRAL map
```

The density can be shown as an overlay, but it does not define the equilibrium classification.

## Runtime state

The reduced browser runtime uses one positive continuous scalar density and one longitudinal redistribution-rate variable:

```text
rho > 0
rho_t = w = -div(J)
```

The second-order form is:

```text
rho_tt = Delta(mu_total)
mu_total = mu_material - action_lambda * mu_action
```

The material candidate is the live 2D counterpart of the current V14H positive-rho family:

```text
mu_material = U'(rho)
            + beta * Delta(rho)
            + gamma4 * Delta^2(rho)
            + alpha * psi

-Delta(psi) = rho-rho0
```

The stiff linearized material part is advanced with an exact spectral step using an in-browser radix-2 FFT. The nonlinear remainder is applied symmetrically around that exact step. The zero Fourier mode is explicitly projected to `rho0`, preserving the mean/amount to numerical precision.

No density clipping is used to hide a bad step. If `rho<=0`, `rho>=rhoMax` or a non-finite value appears, the runtime stops explicitly.

## Live angular-stress candidate

A5 keeps a fast reduced version of the V14H angular-stress candidate. Four or eight real directions are supported. For each direction `j`, the live quasi-static field relaxes toward:

```text
-D_j(a D_j P_j)
+ kappa P_j
+ sigma (P_j-J)
= kappa_bg
```

with

```text
J = mean_j P_j
kappa(rho) = kappa_scale * q/(1-q)
q = rho/rhoMax
sigma = scatter*kappa
```

The browser performs a user-selected finite number of relaxation iterations per physics step and reports the current normalized residual. This is a real iterative solve, not playback and not a precomputed table.

The full 3D GCROT V14H solve remains the high-fidelity source gate; A5 is a reduced interactive laboratory.

## Equilibrium classification

A5 uses the actual readout that drives the reduced runtime:

```text
F = -grad(mu_total)
```

For the same current step it evaluates

```text
K = -Jacobian(F) = Hessian(mu_total)
```

and the two real eigenvalues `lambda_min <= lambda_max`.

Classification:

```text
lambda_min > 0 and lambda_max > 0
  -> WELL / stable in both displayed directions

lambda_min < 0 < lambda_max
  -> SADDLE / stable in one direction and unstable in the other

lambda_max < 0
  -> PEAK / unstable in both directions

one |lambda| below the selected neutral threshold
  -> NEUTRAL / INDIFFERENT / critical-soft direction
```

Equilibrium markers are separate from the background stiffness class. A marker is shown only at a local minimum of `|F|` below the selected zero-force threshold.

This distinction prevents a broad stable region from being mislabeled as a force zero.

## User controls

A5 exposes live controls for:

```text
PLAY / PAUSE / STEP / RESET / NEW SEED
runtime speed
32^2 or 64^2 grid
rho0
dt
B
beta
gamma4
alpha
action lambda
kappa scale
scatter
4/8 angular directions
action relaxation iterations
initial continuous density noise
neutral stiffness threshold
zero-force marker threshold
force-arrow overlay
density overlay
```

The user can click the live map to add a controlled positive/negative density perturbation or a redistribution-rate impulse. The perturbation is explicitly labelled diagnostic and preserves the field mean.

## Display modes

```text
EQUILIBRIUM
  live WELL/SADDLE/PEAK/NEUTRAL stiffness map

DENSITY
  current rho

MU
  current mu_total

FORCE
  current | -grad(mu_total) |
```

Force arrows and equilibrium markers can be overlaid on every view.

## Relation to A4 and V14H

A4 remains the strict read-only 3D K2 bridge for frozen source states:

```text
3D rho -> integral rho ds -> W0/W1/W2/P1-P4/curl
```

A5 is different:

```text
live reduced 2D dynamics -> source-force equilibrium topology now
```

A5 does not promote its reduced state to `FROZEN_V14`, and it does not replace A4/V14H holdouts. Its job is interactive exploration, parameter scans, perturbation experiments and finding candidate branch transitions that must later be checked in the 3D source line.

## Firewalls

```text
NO_FROZEN_FRAME_PLAYBACK
NO_PRECOMPUTED_EQUILIBRIUM_ATLAS
NO_DENSITY_THRESHOLD_AS_EQUILIBRIUM_LAW
NO_HIDDEN_DAMPING
NO_HIDDEN_DENSITY_CLIPPING
NO_PRESCRIBED_CORE
NO_PRESCRIBED_CAVITY
NO_CONTACT_FORCE
NO_PAIR_TANGENTIAL_FORCE
NO_2D_RUNTIME_AS_3D_V14H_EVIDENCE
NO_PHYSICAL_CADENCE
NO_SCALE_BINDING
NO_UPOR_VALIDATION
NO_DIPOLE_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
