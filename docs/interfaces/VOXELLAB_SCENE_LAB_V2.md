# VoxelLab Scene Lab V2

Scene Lab V2 separates scene authoring, simulation, rendering, packing, KOU,
first-hit diagnostics, packet inspection, import/export, diagnostics, and
performance concerns into independent modules under `src/`.

`SceneDocumentV2` stores rigid identity, hierarchy, positive element packing,
current and initial velocities, explicit mobility, simulation settings,
first-hit settings, and an optional exact-antipodal KOU definition. Existing
v1 JSON scenes migrate in-browser and export back as v2.

Simulation uses deterministic symplectic Euler. Integration `dt`, substeps,
playback request, and render FPS cap are independent. Damping is off by default
and can only be enabled through a visibly labelled preview control. Body
identity is `RIGID_GROUP`, while the explicit computational operator is
`POINT_CUBATURE_SC/BCC/FCC/HCP/IMPORTED`. The optional
`EXACT_UNIFORM_SPHERE_EXTERIOR_REDUCTION` is identified separately as an
accelerator for non-overlapping sphere previews, not centre-mass ontology and
not the primary distributed-volume authority.

Generated sphere packings are SC, BCC, FCC, or HCP (HCP is a dense layered
comparison, not a Bravais lattice). Points are sphere-clipped, recentered,
kept positive, and renormalized to the exact body amount. Imported points use
an explicit `IMPORTED_POINTS` route. Display and compute counts remain visible.

The KOU generator creates exactly `n_k = 2 m k^2` bodies on tier `k`, stored as
adjacent antipodal pairs, with explicit ARENA, MOVABLE_BUFFER, GUARD_CONTOUR,
FAR_EXTERNAL_CONTOUR, and NUMERICAL_EDGE_DIAGNOSTIC roles.

First-hit diagnostics use nearest positive ray/sphere intersections. A closed
sampled sky is only a geometric external-support gate; it is not equilibrium,
Upor, scale, or validation.

S11 first imports bounded read-only golden fields from V2B3C commit
`2c7a376cb9276db7bf8eecfc34a1fc0575874f06`. The governed operator catalogue
separates P2 fixed Fibonacci bin-centre curved angular quadrature, P3A adaptive
spherical tessellation, P3B exact-cap/polar-Gauss sphere control, and P3B
global Gauss-Legendre x azimuthal quadrature with shared exact ray intervals.
P3B is not an explicit spherical-polygon Boolean implementation; that route is
reserved as future P3C and is visibly `NOT_IMPLEMENTED`. Browser previews have
`GOLDEN_PARITY=NOT_ISSUED` until a frozen parity packet qualifies them. The
source verdict remains `CURVED_SOLID_ANGLE_ANALYTIC_ORACLE_BLOCKER`.

The recorded P2 value `0.9982902848633791` is a single worst-case relative
outlier. Its scene, component, absolute error, reference denominator and
near-zero status were not supplied, so its cause is not localized and it must
not be paraphrased as a general 99.8% operator error.

`scripts/runSceneSuite.ts` loads all 17 scenes, executes the required controls,
300-step dynamic runs, and 3000-step long runs for S04, S06, S12, S13, S14,
and S15. It records engineering receipts only.

Authoritative scientific verdicts remain governed repository packets. No
Upor, dipole, photon, physical scale, or validation is claimed.
