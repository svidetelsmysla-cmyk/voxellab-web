# ACTION LAB — V14H SOURCE-DIRECT SCALE-DIMENSION RESULT V1

Date: 2026-08-16  
Status: DIAGNOSTIC SCALE-SPACE RESULT / NO PHYSICAL-LAW PROMOTION

## Question

Translate Viktor's qualitative containing-volume uniformity idea into a measurable scale curve without identifying scalar homogenization with disappearance of internal structure.

## Source

`V14H_TRUE_3D_POSITIVE_RHO_REPLAY_SOURCE_V1.npz`

```text
grid = 16^3
L = 24
dx = 1.5
rho global mean = 0.35
```

The browser `rho.f32` is byte-identical to the source float32 snapshot stack. The source A4 coordinate frame is `[0,24)`; this source-direct analysis uses that native frame and periodic minimum-image distances rather than the browser display origin.

## Objective containing-volume centre

At each source frame choose the grid point maximizing

```text
|rho - <rho>|.
```

This is the strongest current local inhomogeneity and does not use a target object radius or density threshold.

For nested periodic containing spheres compute

```text
M(R)      = integral rho dV
M+(R)     = integral max(rho-<rho>,0) dV
M-(R)     = integral max(<rho>-rho,0) dV
Relief(R) = M+(R)+M-(R)
C(R)      = |M+(R)-M-(R)| / Relief(R)

D_amount(R) = d ln M / d ln R
D_relief(R) = d ln Relief / d ln R
```

Local log slopes use a seven-point moving log-regression because N16 is too coarse for a two-neighbour derivative to be trustworthy.

## t=70 result

Strongest local contrast centre:

```text
(3.0, 21.0, 22.5)
rho_extreme = 0.925433
rho_global_mean = 0.35
```

The strongest sampled scalar cancellation occurs near

```text
R = 8.246800
C(R) = 0.069506
mean(delta rho) = -0.008940
mean(|delta rho|) = 0.128620
RMS(delta rho) = 0.162831
D_relief(R) = 2.928010
```

Thus the signed scalar contrast is already strongly cancelled in the containing volume while the absolute and RMS inhomogeneity remain large.

This is direct numerical support, within this finite candidate history, for the distinction:

```text
SCALAR HOMOGENIZATION
!=
DISAPPEARANCE OF INTERNAL STRUCTURE.
```

## Important negative result

The late V14H relief does **not** behave like a compact dimension-zero perturbation over the accessible N16/L24 scale range. Around and beyond the strongest cancellation region, `D_relief` is close to three. The raw density fluctuations are therefore approximately volume-filling at this stage/history.

That is consistent with the historical continuous-substrate picture in which formation/breathing organization can be distributed into global substrate modes. It is not evidence that a finished isolated particle has fractal dimension three.

The current finite box is too small to establish an asymptotic Universe exponent.

## Relation to R17 scale-resonance critique

This result repairs one possible circularity. A scale-transfer exponent must not be manufactured by fitting an `eta` to the final gain. The current program separates independent measurements:

```text
1. MATERIAL SCALE CURVE
   D_amount(R), D_relief(R), C(R)

2. ANGULAR PERSISTENCE
   normalized P_l(R) or later a true transfer eigenvalue lambda_l

3. MECHANICAL SOFTNESS
   kappa_soft from the relevant branch

4. NATURAL INTER-LEVEL GEOMETRY
   daughter separation / emergent parent scale
```

Only if these independently measured channels coincide across natural events does `scale resonance` become a physical mechanism rather than a bookkeeping identity.

## Browser-coordinate warning found during this work

The WebGPU packet stores the exact source `rho` array but uses a display grid origin of `(-12,-12,-12)`, while `world_midpoint` / registered geometry remains in the source `[0,24)` coordinates. Therefore any new material scale analysis must explicitly crosswalk source coordinates to the browser display frame. The source-direct result above is unaffected.

Do not silently use `world_midpoint` as though it were already expressed in the centered display frame.

## Next

Keep the existing Action Lab Local Power Exponent and R15 fold panels. Add/retain three independent measured plots:

```text
D_relief / C(R)     material homogenization
P1,P2 scaling       angular persistence proxy
kappa_soft          mechanical branch softness
```

When R17 produces natural birth/split/merge events, add:

```text
daughter separation / parent emergent scale
scale-collapse overlays
log-periodic residual test for discrete scale invariance.
```

No claim of universality class, self-organized criticality, total physical force or inter-level resonance is made here.
