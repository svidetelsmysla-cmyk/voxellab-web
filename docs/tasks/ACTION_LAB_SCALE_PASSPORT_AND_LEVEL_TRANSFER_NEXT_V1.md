# ACTION LAB — SCALE PASSPORT AND LEVEL TRANSFER NEXT V1

Date: 2026-08-17
Base: `r6/action-lab-scale-law-explorer-v1` @ `fa4e4a00798330e05e37974fadcf5aebd291023d`
Status: UI / ANALYTIC INSTRUMENT TASK / NO NEW PHYSICS LAW

## Purpose

Extend Action Lab from separate scale-law diagnostics into one coordinated read-only **Scale Passport** for R17/V14H source packages while preserving the separation:

```text
R_core / R_relief
R_comp_local
R_comp_global
R_homothetic_capacity
R_cap(Omega)
lambda_star
R_term(Omega)   [only when natural external centres exist]
```

The UI must make coincidence a measured result, never a default assumption.

## Panel 1 — Material Scale

Inputs:

```text
rho frame / branch centre / source geometry
```

Readouts:

```text
strong-relief scale;
D_q^center(R), q=0.5,1,2,4;
high-q knee candidates;
profile collapse in r/R_core;
centre-definition sensitivity.
```

Firewall:

```text
D_q^center is not multifractal D_q.
```

## Panel 2 — Material Compensation

Readouts:

```text
M_plus(R)
M_minus(R)
A_0(R)
C_0(R)
local compensation feature(s)
global compensation range.
```

If the curve contains two scales, show two scales. Do not output one universal cavity radius.

## Panel 3 — Homothetic Capacity

Display the R17 V3 capacity section separately.

Required label:

```text
HOMOTHETIC ADMISSIBILITY FAMILY
NOT AUTOMATIC OBJECT SIZE
```

Overlay R_core/R_comp/R_cap only for comparison.

## Panel 4 — Total-Force Capsule

Enabled only when an accepted total mechanical response is supplied.

Readouts:

```text
force zero/root surfaces;
kappa eigenvalues;
kappa_min;
restoring/saddle/neutral/repelling class;
directional support radius R_cap(Omega) where well-defined;
perturbation-return traces when supplied.
```

Do not substitute W1/action-moment roots for total-force roots.

## Panel 5 — Constitutive Preferred Scale

For historical V14H or any source with a declared linear operator:

```text
dispersion / growth curve versus k;
k_star;
lambda_star=2*pi/k_star;
bandwidth;
R_core/lambda_star;
R_relief/lambda_star;
R_comp_local/lambda_star;
R_cap/lambda_star.
```

This panel is primarily a self-closure detector.

## Panel 6 — External Support / Chrysanthemum

Disabled by default for one-centre data.

Enable only when source package contains multiple naturally formed external centres.

Use source-derived centre geometry; do not insert S10 `a=1.4`.

Readouts:

```text
R_term(Omega);
coverage;
owner fraction by natural distance band / cluster;
far-environment saturation;
angular-resolution convergence;
normalized lobe spectrum.
```

## Panel 7 — Blind Level Predictor

Disabled until adjacent natural levels are frozen independently.

Before revealing level l+1 cavity share, lock:

```text
L_l
L_(l+1)
b_l
Phi_l
f_cav,l
delta_merge if preregistered.
```

Then show prediction:

```text
1-f_pred,l+1 = Phi_l*(1-f_l)
```

and

```text
D_pred = 3 + ln(Phi_l)/ln(b_l).
```

Only after lock may measured target values be displayed.

The UI must preserve a visible `PREDICTION FROZEN BEFORE TARGET` receipt.

## Panel 8 — Scale Transfer Comparison

For repeated natural levels show normalized overlays:

```text
rho profile / relief;
material compensation curves;
force-capsule topology;
angular spectrum / R_term where eligible;
R_cap/R_core;
R_term/R_core;
Phi_l;
b_l;
D_pred vs D_direct.
```

Search for stable transformation rules or cycles, not just visual resemblance.

## Required decisions

The panel must allow clear negative labels:

```text
CORE_WITHOUT_FORCE_CAPSULE
CAPACITY_SCALE_DIFFERS_FROM_OBJECT_SCALE
LOCAL_SCALE_TRACKS_CONSTITUTIVE_LAMBDA
GLOBAL_COMPENSATION_ENVIRONMENT_COUPLED
NO_NATURAL_TERMINAL_CLOSURE
NO_ADJACENT_LEVEL
CAVITY_RECURSION_BLIND_FAIL
NO_SCALE_TRANSFER_COLLAPSE
```

## No-go rules

Do not:

```text
change R17 mechanics;
fit lambda_star to object radius;
fit Phi to target cavity share;
turn S30 recursion into dynamics;
use Chrysanthemum to create the first centre;
call W1 total force;
call centred D_q multifractality;
merge R_comp and R_term into one boundary.
```

## First implementation checkpoint

Build the UI/data contract for Panels 1–5 only using existing V14H/R17-compatible fields.

Panels 6–8 remain visibly gated until natural multi-centre / adjacent-level source packets exist.

STOP after the first checkpoint and return:

```text
build status;
tests;
accepted data schema;
which scale fields are source-native versus derived;
which panels remain blocked by missing R17 outputs.
```
