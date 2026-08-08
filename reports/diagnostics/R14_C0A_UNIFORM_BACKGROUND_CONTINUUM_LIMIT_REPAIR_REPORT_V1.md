# R14 C0A — UNIFORM BACKGROUND CONTINUUM LIMIT REPAIR REPORT V1

Date: 2026-08-08  
Worker: `R14_ACTION_TRANSPORT_CONTINUATION`  
Task: `R14_C0A_UNIFORM_BACKGROUND_CONTINUUM_LIMIT_REPAIR_AND_C1_REPLAY_V1`

```text
PRIMARY VERDICT =
  C0A_NUMERICAL_CONVERGENCE_OR_SAMPLER_BLOCKER

C1 REPLAY =
  BLOCKED

NEW PHYSICS ADDED =
  NO

PHYSICAL VALIDATION =
  NO

CANON PROMOTION =
  NO

MERGE =
  NO
```

## 1. Question

The inherited R13 branch published `C0_UNIFORM_BACKGROUND_NOT_OBTAINED` from a finite-N direct-pair relaxation control. C0A asked whether that negative was a genuine failure of the declared discrete direct-pair operator or a sampler / finite-N / regularization / relaxation / diagnostic artifact.

The C0A run was performed from exact inherited R13 head `e0dc4f66ca257a6b5a4f47e45ee67785868370d5` on branch `r14/c0a-uniform-background-continuum-repair-v1`. The numerical matrix and decision vocabulary were committed before repaired runtime at `8c373d85a6524be266cba1d4a6477a9a3013f249`.

## 2. What was repaired

The R13 spherical initializer coupled radial and polar coordinates through the same scalar `u`. C0A replaces only that sampling defect with a deterministic independent low-discrepancy sphere-volume sampler:

```text
r      <- Halton base 2
cosθ   <- Halton base 3
φ      <- Halton base 5
seed   <- none
```

The direct-pair operator, B0 analytic reservoir, relaxation step law, recentering semantics, domain cap, and interpretation ceiling remain inherited. No contact, pressure, hard core, Upor, fitted cavity radius, particle deletion, or damping-as-physics was introduced.

## 3. Pre-relaxation sampler gate

All preregistered sampler gates pass at all five N values.

| N | COM/R | covariance anisotropy | gate |
|---:|---:|---:|---|
| 96 | 0.020356280 | 0.072576794 | PASS |
| 192 | 0.012639273 | 0.021216367 | PASS |
| 384 | 0.006136703 | 0.029685301 | PASS |
| 768 | 0.003516921 | 0.011624115 | PASS |
| 1536 | 0.001684009 | 0.008098877 | PASS |

Angular `P1..P4`, radial cumulative amount, rotation-covariance, and spacing checks also pass. Therefore the inherited radial/polar correlation has been removed as the immediate C0A blocker.

## 4. B0 continuum oracle

For the declared continuum fixture:

```text
a_self(r)      = +(4*pi/3) rho r
a_reservoir(r) = -(4*pi/3) rho r
a_total(r)     = 0
```

Maximum relative residual across the frozen radial probe set is `0`: **PASS**.

This is a method oracle only; it is not physical validation.

## 5. Primary N refinement

Frozen primary lane: iterations = 160, softening/spacing = 0.32.

| N | legacy bulk RMS | cumulative M(<r) max error | shell oscillation | boundary fraction | relaxation converged |
|---:|---:|---:|---:|---:|:---:|
| 96 | 0.971522 | 0.375458 | 1.679736 | 0.010417 | NO |
| 192 | 0.380543 | 0.271000 | 1.468705 | 0.510417 | NO |
| 384 | 0.277513 | 0.221521 | 1.010046 | 0.489583 | NO |
| 768 | 0.217337 | 0.102698 | 0.938538 | 0.416667 | NO |
| 1536 | 0.072599 | 0.063635 | 0.228361 | 0.354167 | NO |

The highest N snapshot is much closer to coarse uniformity (`N=1536`, RMS `0.072599`), which confirms that the old N=96 negative cannot be promoted to an operator-level physical conclusion.

However the preregistered `N=768 -> 1536` stability gate fails:

```text
legacy RMS absolute delta       = 0.144737758   (limit 0.10)
cumulative amount error delta   = 0.039062500   (limit 0.04)
anisotropy delta                = 0.000006922   (limit 0.04)
boundary fraction delta         = 0.062500000   (limit 0.05)

N refinement stability = FAIL
```

## 6. Iteration refinement

Frozen iteration lane: `N=384`, softening/spacing = 0.32.

| iterations | legacy bulk RMS | cumulative M(<r) max error | relaxation converged |
|---:|---:|---:|:---:|
| 160 | 0.277513 | 0.221521 | NO |
| 320 | 0.490507 | 0.237146 | NO |
| 640 | 0.705332 | 0.265792 | NO |

`320 -> 640` also fails the preregistered stability gate; the legacy RMS worsens rather than settling:

```text
legacy RMS absolute delta       = 0.214824746
cumulative amount error delta   = 0.028645833
anisotropy delta                = 0.000172897
boundary fraction delta         = 0.007812500

iteration refinement stability = FAIL
```

All preregistered runs remain `converged=false` under the inherited displacement stopping criterion.

## 7. Secondary softening control

Frozen secondary lane: `N=384`, iterations = 320.

| softening/spacing | legacy bulk RMS | cumulative M(<r) max error |
|---:|---:|---:|
| 0.16 | 0.365795 | 0.106313 |
| 0.08 | 0.364872 | 0.103708 |

These values are numerical controls only. They are not used to choose a preferred physical law and are not tuned to create a cavity.

## 8. Decision

The repaired sampler and continuum oracle both pass, so **the original sampler defect is real and repaired**. But the discrete relaxation has not yet produced a refinement-stable trustworthy C0 baseline. The present evidence therefore does **not** establish either of the stronger claims:

```text
NOT ESTABLISHED:
  "direct pairwise operator fails the continuum limit"

NOT ESTABLISHED:
  "trustworthy uniform C0 is recovered"
```

The only allowed preregistered verdict supported by the full matrix is:

```text
C0A_NUMERICAL_CONVERGENCE_OR_SAMPLER_BLOCKER
```

Here the remaining blocker is numerical convergence/refinement, not the repaired sampler itself.

## 9. C1 gate

C1 may run only after a trustworthy C0 exists. That gate did not open.

```text
C1_REPLAY_OPEN = false
C1 = BLOCKED
```

Accordingly no C1 cavity replay was executed in C0A, no C1V fitting was performed, and the R13 generated-cavity panel is retained only as historical prior-lineage evidence rather than a current R14 physical claim.

## 10. Provenance

```text
base R13 head =
  e0dc4f66ca257a6b5a4f47e45ee67785868370d5

preregistration commit =
  8c373d85a6524be266cba1d4a6477a9a3013f249

governed runtime head =
  f796ab9f6b0f42b484de53315e4365720fdb512e

GitHub Actions run =
  31259189945

artifact id =
  9022281065

artifact ZIP digest SHA256 =
  1be3a2639ce521bfebd3b71628ffad261444a20570c8e42d4c93bb9fdc8cdd21

runtime receipt SHA256 =
  7b683c35cc3d4c04867c412204e66bafc434b01aeb158bb04e62c678bdecb873
```

The governed CI passed typecheck, unit tests, runner build, complete preregistered runtime, and artifact upload.

## 11. Stop condition / next boundary

C0A stops here. No new physics is added to rescue C0.

A future `C0B_VOLUME_SUPPORT_MECHANISM_DISCRIMINATOR` may be opened only as a separately preregistered task. C1 remains blocked until a trustworthy C0 is established.

Firewalls remain: no Upor claim, no contact/hard-core promotion, no pressure/incompressibility import, no physical-time interpretation, no scale binding, no validation, no canon promotion, no merge.
