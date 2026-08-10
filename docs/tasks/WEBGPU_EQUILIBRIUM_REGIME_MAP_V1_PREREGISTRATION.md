# WEBGPU EQUILIBRIUM REGIME MAP V1 — PREREGISTRATION

Date: 2026-08-10

Task: `WEBGPU_EQUILIBRIUM_REGIME_MAP_V1`

Status: FROZEN BEFORE GPU/CPU COMPARISON

## Authority and scope

The browser work starts from A4 commit
`ca4ff979b4aa70b3b3123fc158f2c29c9c4e8bee`. The current physics authority
was rechecked at `7172b5a96c647b3f1d12e2a1daad378d59f7b72e`; the task-packet baseline
`f08e6c4c936eb309aa90fda3e52a5103f3821ffe` is its ancestor. The intervening
V14M0/V14M1 delta does not replace the V14K-first order and does not promote
action readout to physical source force.

V1 is a read-only instrument. It may establish numerical parity and an action
topology diagnostic. It may not establish source force, material following,
static two-centre support, dipole, scale, or validation without the later
registered gates.

## Frozen route

```text
frozen V14H rho(t)
→ authoritative offline float64 direct-volume response volume
→ stored float32 P1 response packet
→ WebGPU plane sampling and 3D Jacobian classification
→ deterministic CPU root refinement and 3D qualification
→ branch timeline independent of density labels
```

The closures are separate `FINITE_BOX` and `NEAREST_PERIODIC` lanes. Source,
receiver, and render resolutions remain separate. Density is an optional
same-frame overlay and cannot create a root or branch.

## Frozen numerical rules

- Response sign: source minus receiver displacement, matching V14J2.
- Self cell: exact zero by registered symmetry; no softening.
- `K = -sym(J)`; full three-dimensional eigenvalues qualify every root.
- Nonconservative ratio: `||antisym(J)||F / max(||sym(J)||F, 1e-30)`.
- Candidate cells require component-wise sign brackets.
- Roots use trilinear Newton refinement, in-cell rejection, residual check,
  deterministic deduplication, and full-3D reclassification.
- Branches use global minimum-cost assignment with two-frame persistence.
- Neutral rule and all tolerances are frozen in the machine-readable receipt.

## Firewalls

`NO_DENSITY_COMPONENT_AS_BRANCH_ID`, `NO_RENDER_RESOLUTION_AS_SOURCE_RESOLUTION`,
`NO_2D_ROOT_PROMOTION`, `NO_ACTION_AS_SOURCE_FORCE`, `NO_PER_FRAME_FIT`,
`NO_OPACITY_FIT`, `NO_NEGATIVE_MATTER`, `NO_DIPOLE`, `NO_SCALE`,
`NO_VALIDATION`, `NO_CANON_PROMOTION`.
