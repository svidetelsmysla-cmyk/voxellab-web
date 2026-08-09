# VoxelLab A4 / V14 continuous-field research plan V1

## Mission

Connect the successful or diagnostically useful continuous-substrate solver states to the existing Action Lab readout without introducing a new force law.

The central research question is:

```text
Can the already implemented receiver-centred positive angular action map
read the actual V5/V6/V14 rho states in a way that:

1. converges numerically;
2. preserves source provenance;
3. reproduces the direction and ordering of measured solver response;
4. distinguishes transparent, first-owner and later source-locked transport laws;
5. exposes the pre-split W2 / multipole sequence;
6. remains compatible with -grad(mu) when mu is available?
```

A4 begins as read-only. No A4 quantity may be fed back into the dynamics in this programme.

## Current locked state

### Already available

```text
A0-A3 action-column and moment machinery;
A0.3 proof that two constant-ratio 1/r^2 branches have no unique finite root;
A2/A2B amount and free-boundary geometry controls;
D0S static positive-representation parity;
C0/C1 negative result for a naive finite microbody reservoir;
continuous-substrate formation and corridor work in the governed solver line.
```

### Newly implemented in A4

```text
strict cell-centred rho snapshot contract;
transparent K2 integral;
source-owner K2 limit;
W0/W1/W2;
real P1-P4;
trace closure;
curl estimate;
reference-vector comparison;
browser JSON loader;
synthetic method gate.
```

### Still absent from the A4 branch

```text
frozen V5/V6/V14 rho packet;
frozen measured dynamic-response vector at matching receivers;
mu field export;
source-derived owner IDs for real formed domains;
V14C ordered pre-split snapshot series.
```

Therefore:

```text
CURRENT OVERALL STATUS =
A4_METHOD_BRIDGE_IMPLEMENTED_V14_SNAPSHOT_EXPORT_BLOCKER
```

## Research lanes

The work is split into five non-interchangeable lanes.

```text
A4-M  method and numerical parity
A4-E  solver export and provenance
A4-R  read-only physical readout
A4-D  discriminators and holdouts
A4-F  possible later feedback gate
```

`A4-F` is closed until all prior lanes pass. A method PASS in `A4-M` cannot be used as evidence for `A4-R`.

---

# Gate G0 — frozen source export

## Purpose

Create the minimum authoritative bridge input without manually reconstructing a solver state in the browser.

## Required V5 corridor bundle

For each frozen receiver/body separation in the already governed V5 corridor:

```text
snapshot_id;
rho[nx,ny,nz];
origin;
spacing;
dimensions;
solver step / relational state label;
source commit;
packet SHA256;
measured dynamic-response vector;
receiver/body coordinates;
all normalization constants actually used by the source solver;
boundary and box metadata;
claim ceiling.
```

The corridor points must be chosen from the existing source run, not after viewing A4 output.

## Required V6 holdout bundle

At least:

```text
one state inside the restoring side;
one state near the measured root;
one state outside the restoring side;
one geometry/orientation holdout not used to select an A4 channel.
```

## Required V14 formation bundle

At least:

```text
F0 homogeneous / pre-formation state;
F1 first statistically significant condensation;
F2 formed single-core state;
F3 mature core+cavity state;
F4 late stable or terminal state.
```

## Required V14C split bundle

A monotonic ordered sequence containing:

```text
last clearly one-centre state;
first stiffness-warning state if source diagnostics provide it;
first shoulder / neck state;
first two-centre diagnostic state;
first topological split state;
one post-split state.
```

## Optional fields

```text
mu[nx,ny,nz];
J vector field;
source-emergent ownerIds;
core/cavity/contour diagnostic masks;
source force/readout density;
energy and conservation channels.
```

Optional fields must not be inferred if absent.

## G0 acceptance

```text
PASS only if:
  array lengths and coordinates close exactly;
  rho is finite and non-negative under the source contract;
  frozen provenance hashes are complete;
  every requested receiver maps unambiguously to the grid;
  measured response and snapshots share the same source state;
  no browser-generated field is substituted.

BLOCKER if:
  only PNG/video exists;
  only an aggregate radial curve exists;
  receiver and snapshot times do not match;
  source normalization is unknown;
  core/cavity masks were hand-authored for A4.
```

## G0 output

```text
R14_A4_V5_V6_V14_FROZEN_SNAPSHOT_PACKET_V1
R14_A4_FROZEN_SNAPSHOT_MANIFEST_V1
R14_A4_SOURCE_TO_BROWSER_PARITY_RECEIPT_V1
```

---

# Gate G1 — representation and quadrature parity

## Purpose

Show that A4 reads the exported arrays, not artefacts of indexing, angular sampling or line stepping.

## G1A — array reconstruction

For every source packet:

```text
total positive amount from rho*cell_volume;
centre of amount;
second-moment tensor;
registered source scalar checksums.
```

Compare browser and source-side recomputation.

## G1B — constant-q A3/A4 identity

Export one uniform sphere on the same grid and compare:

```text
A3 q*H(Omega);
A4 integral rho ds;
analytic A0 volume oracle.
```

This closes the transition from A3 K1 to A4 K2.

## G1C — refinement family

Run the frozen family:

```text
angular directions:
  2048, 4096, 8192, 16384, 32768

line step:
  1.00, 0.75, 0.50, 0.35 cell spacing

grid:
  every authoritative source refinement actually available
```

No interpolation refinement may be manufactured and described as a new solver state.

## G1D — covariance controls

```text
particle/array order: not applicable to rho values, but serialization order is checked;
axis permutation;
global rigid rotation of a synthetic oracle;
receiver reflection;
box translation with matching coordinate translation.
```

## G1 acceptance

Preregister exact tolerances from source precision before running real packets. Required qualitative conditions:

```text
W0, W1 and W2 converge;
trace(W2)-W0 converges to numerical floor;
P1-P4 stabilize;
source/browser amount and low moments agree;
no result changes class under permitted refinement.
```

## G1 negative controls

```text
transpose two grid axes without metadata update -> must fail;
shift origin by one cell -> must fail parity;
truncate packet SHA -> must fail contract;
insert one negative rho -> must fail contract;
remove ownerIds then request first-owner -> must block.
```

---

# Gate G2 — V5 corridor readout

## Purpose

Test whether the existing V5 restoring corridor is visible in the positive angular readout.

## Frozen channels

For each V5 corridor state compute, without fitting:

```text
T0 = transparent full-column W1;
T1 = first registered owner W1, only if ownerIds are source-exported;
D10 = T0 - T1 signed diagnostic;
C10 = C1 full-column - matched C0 full-column, only for paired source states;
W2 deviator and P1-P4.
```

No channel may be selected after seeing which one crosses zero.

## Dynamic reference

The source packet must provide the measured solver response:

```text
a_measured or equivalent governed readout vector
```

at the same state and coordinate convention.

A4 computes:

```text
cosine alignment;
best one-coefficient map;
relative residual after that one coefficient;
root ordering;
inside/root/outside sign ordering.
```

The coefficient is fitted only once on a preregistered calibration subset. It must then be frozen for holdouts.

## Primary G2 questions

```text
Q2.1 Does W1 point along the measured response?
Q2.2 Can one constant scalar coefficient explain the corridor?
Q2.3 Does any registered channel change sign or ordering near the measured root?
Q2.4 Does the readout distinguish restoring from non-restoring sides?
Q2.5 Is the result stable to grid/ray refinement?
```

## G2 outcomes

### G2-PASS-A — directional parity

```text
alignment and holdout residual pass;
no claim of physical cadence;
opens G3 and G4.
```

### G2-PASS-B — useful bounded discriminator

```text
transparent and first-owner limits bracket or order the measured response
but neither alone closes it;
opens a transport-law discriminator, not validation.
```

### G2-NULL

```text
all A4 channels remain proportional with no finite ratio change;
A4 confirms that the missing ratio-changing mechanism is not present
in these readouts.
```

### G2-BLOCKER

```text
readout class changes under refinement;
source response and snapshot cannot be aligned;
owner mask is not source-derived;
only a target-root fit succeeds.
```

## Prohibited G2 procedure

```text
choose attenuation parameters to force W1(r*)=0;
move receiver locations after reading the curve;
treat A0.3 isotropic reradiation as source canon;
rename signed C1-C0 differences as negative matter;
bind seconds, newtons or metres.
```

---

# Gate G3 — transparent / owner / transport discriminator

## Purpose

Determine which information is missing between the two already implemented limits.

## Registered endpoints

```text
T0 transparent:
  every positive rho sample contributes.

T1 first-owner:
  first source-exported formed-domain owner contributes;
  behind-owner domains do not.
```

These are method endpoints, not competing validated theories.

## G3A — endpoint comparison

Across V5 and V6 holdouts record:

```text
T0 W0/W1/W2/P1-P4;
T1 W0/W1/W2/P1-P4;
T0-T1;
measured response alignment and residual.
```

## G3B — ownership sensitivity

Repeat only when source exports alternative legitimate domain diagnostics:

```text
core owner;
core+cavity owner;
external separatrix owner.
```

These alternatives must be source diagnostics, not A4-drawn masks.

## G3C — no-owner lane

When the continuous solver does not supply an owner decomposition:

```text
T1 remains BLOCKED;
T0 continues;
no density threshold is used to invent ownerIds.
```

## G3 decision

```text
If T0 alone passes:
  no opacity law is needed at this readout level.

If T1 alone passes:
  first-owner remains a candidate method limit;
  still requires independent holdouts.

If measured response lies reproducibly between T0 and T1:
  open G7 candidate transport family.

If neither endpoint carries the measured ordering:
  stop opacity fitting and return to the source/readout decomposition.
```

---

# Gate G4 — potential compatibility and mu bridge

## Purpose

Test whether the A4 directional moment can be compared to the continuous solver's chemical-potential/readout gradient.

## Required source input

```text
mu on the same grid and same frozen states;
source convention for grad(mu);
boundary stencil;
masked invalid regions;
source-side gradient or checksum when available.
```

## G4A — A4 curl

For preregistered receiver volumes compute:

```text
curl W1;
normalized curl;
closed-loop circulation on axis-aligned loops;
refinement of both receiver spacing and angular quadrature.
```

## G4B — gradient comparison

Compare:

```text
W1_A4
versus
-grad(mu)
```

through:

```text
direction cosine;
single-coefficient residual;
spatial residual map;
near-core, cavity, transition and far-domain strata.
```

## G4 interpretation

```text
curl PASS is necessary but not sufficient;
alignment PASS does not bind physical force;
large curl localizes a readout/operator mismatch;
failure near singular or masked cells must be separated from bulk failure.
```

## G4 outcomes

```text
POTENTIAL_COMPATIBLE_READOUT_CANDIDATE
CURL_OR_GRADIENT_MISMATCH
MU_EXPORT_BLOCKER
NUMERICAL_STENCIL_BLOCKER
```

---

# Gate G5 — V14C pre-split ordering

## Purpose

Test whether angular action diagnostics change before, at or after morphological splitting.

## Frozen observables

For every ordered snapshot:

```text
W0;
W1;
full W2 eigenvalues;
normalized dev(W2);
P1-P4;
source core count;
source cavity scale;
source neck/shoulder diagnostic;
source split/topology label;
source stiffness or Hessian diagnostic when available.
```

## Receiver families

Freeze before running:

```text
R0 centre/COM diagnostic receiver;
R1 axis receivers on both sides;
R2 equatorial receivers;
R3 far receivers;
R4 source-defined contour receivers if exported.
```

No receiver may be placed by looking at the eventual split lobes.

## Primary temporal-order tests

```text
T5.1 Does P2 or dev(W2) rise before two-centre morphology?
T5.2 Does one W2 eigenvalue or a source stiffness approach zero first?
T5.3 Does P4 distinguish necking from simple ellipsoidal deformation?
T5.4 Does W1 remain near its symmetry null while W2 changes?
T5.5 Is the sequence stable to rotation and refinement?
```

## Required ordering classes

```text
ACTION_TENSOR_PRECEDES_SPLIT
ACTION_TENSOR_COINCIDENT_WITH_SPLIT
ACTION_TENSOR_FOLLOWS_SPLIT
NO_REPRODUCIBLE_ACTION_TENSOR_SIGNAL
SOURCE_STIFFNESS_EXPORT_BLOCKER
```

A temporal precedence result is a diagnostic ordering, not proof of causal mechanism.

## Negative controls

```text
time-reversed label order;
snapshot permutation;
single-core non-splitting run matched in cavity scale;
rotated copy;
resolution-matched synthetic two-lobe field.
```

The synthetic two-lobe field may test detection sensitivity only.

---

# Gate G6 — boundary, resolution and representation independence

## Purpose

Prevent a visually persuasive A4 map from being a box, mask or interpolation artefact.

## Required comparisons

```text
available box sizes;
available grid spacings;
source boundary modes;
receiver distance from the box;
line-step family;
angular family;
trilinear versus source-side direct integration when available;
owner and no-owner lanes.
```

## Registered metrics

```text
relative W0/W1/W2 change;
P1-P4 change;
curl change;
root-location change in dimensionless corridor coordinate;
classification stability;
boundary-shell contribution.
```

## G6 pass ceiling

```text
READOUT_NUMERICALLY_STABLE_ON_AVAILABLE_SOURCE_FAMILY
```

It does not mean continuum-limit proof unless an actual source refinement sequence supports that claim.

---

# Gate G7 — candidate finite-transparency / transport law

## Opening condition

G7 is closed unless:

```text
G0 PASS;
G1 PASS;
G2 establishes a reproducible mismatch that lies between or is structured by T0/T1;
G3 identifies a genuine transport-law question;
G6 shows the endpoint readouts are numerically stable.
```

## Candidate construction rules

Candidate laws must be derived from source-supported state variables. Permitted generic form:

```text
Sigma_eff(Omega)
  = integral rho(s,Omega) T(s,Omega; source state) ds
```

But `T` cannot be chosen from convenience alone.

Candidate ingredients may be considered only with explicit source lineage:

```text
integrated positive column;
local rho;
source-defined saturation measure;
source-defined cavity/contour diagnostic;
path history already present in the solver;
source-derived redirection channel.
```

## Forbidden ingredients

```text
target equilibrium radius;
observed force residual used inside the law;
hand-drawn cavity radius;
post hoc angular masks;
arbitrary exponential attenuation merely because it fits;
physical constants imported before scale binding;
hidden negative density.
```

## Preregistration

Before evaluation freeze:

```text
candidate family;
parameter count;
calibration states;
holdout states;
loss function;
null models T0 and T1;
complexity penalty;
acceptance thresholds;
failure interpretation.
```

## G7 possible outcomes

```text
SOURCE_COMPATIBLE_TRANSPORT_CANDIDATE_SURVIVES_HOLDOUTS
TRANSPARENT_LIMIT_SUFFICIENT
FIRST_OWNER_LIMIT_SUFFICIENT
NO_CANDIDATE_BEATS_ENDPOINT_CONTROLS
TARGET_FIT_ONLY_REJECTED
```

No G7 outcome is validation.

---

# Gate G8 — read-only dynamic replay

## Purpose

Apply the frozen A4 readout to a sequence of solver states without changing those states.

## Procedure

```text
load frozen trajectory snapshots;
compute A4 channels at every frozen step;
compare with next-step source response;
freeze one coefficient on calibration;
evaluate prediction on held-out steps and runs.
```

## Tests

```text
directional next-step prediction;
root crossing prediction;
split-warning lead time;
orbit/encounter holdouts;
time reversal;
state-label permutation;
coefficient transfer across runs.
```

## G8 ceiling

```text
READ_ONLY_DYNAMIC_PREDICTION_CANDIDATE
```

This still does not permit feedback.

---

# Gate G9 — separate feedback experiment

## Opening condition

Only after independent producer review of G0-G8.

## Mandatory separation

A feedback experiment must be a new branch and preregistration:

```text
A4-F is not added silently to V14;
baseline dynamics remain frozen;
energy/accounting consequences are explicit;
no double counting of an already present source term;
stability and conservation gates are preregistered;
all negative controls are rerun.
```

## G9 possible outcomes

```text
FEEDBACK_OPERATOR_REDUNDANT
FEEDBACK_OPERATOR_DOUBLE_COUNTS_EXISTING_RESPONSE
FEEDBACK_OPERATOR_NUMERICALLY_UNSTABLE
FEEDBACK_OPERATOR_SURVIVES_DIAGNOSTIC_HOLDOUTS
```

Even the last result does not bind physical scale or validation.

---

# Immediate execution plan

## Step 01 — freeze A4 method branch

Deliver:

```text
continuousFieldActionBridge.ts;
browser panel;
strict JSON loader;
unit tests;
Playwright test;
CI method gate;
interface contract;
this research plan;
method status packet.
```

Decision:

```text
METHOD PASS opens export only.
```

## Step 02 — source-side exporter

Worker should implement in the authoritative solver repository, not in `voxellab-web`.

Required exporter functions:

```text
write rho in x-fastest cell-centred order;
write coordinate metadata;
write measured readout at matched state;
optionally write mu and ownerIds;
compute source array hashes;
emit manifest and receipt;
run round-trip readback.
```

## Step 03 — minimal V5 packet

Export only three preregistered states first:

```text
inside restoring corridor;
near measured root;
outside restoring corridor.
```

Run G0/G1 before expanding the packet.

## Step 04 — V5 corridor packet

After minimal round-trip PASS, export the full frozen corridor and measured response. Run G2 and G3.

## Step 05 — V6 independent holdouts

Use states not involved in channel or coefficient selection.

## Step 06 — mu/curl packet

Export `mu` only after coordinate and mask semantics are documented. Run G4.

## Step 07 — V14C sequence

Freeze the temporal sequence before computing A4. Run G5 and G6.

## Step 08 — candidate-law decision

Open G7 only if endpoint controls leave a structured, reproducible gap.

## Step 09 — dynamic replay

Run G8 read-only.

## Step 10 — producer review

Decide whether any separate feedback experiment is justified.

---

# Worker split

## R14 — bridge and numerical controls

```text
A4 implementation;
snapshot contract;
quadrature/refinement;
browser receipts;
curl and multipoles;
status packets.
```

## R6 — source solver and dynamic authority

```text
authoritative snapshot export;
measured response alignment;
V5/V6/V14 state selection;
source normalization;
no browser-side reconstruction.
```

## R13 — source and external-method audit

```text
verify that any transport candidate has source lineage;
separate Viktor source claims from project assumptions;
review opacity/column analogies without promotion.
```

## Producer / governance reviewer

```text
freeze calibration and holdouts;
approve gate transitions;
reject target fitting;
maintain claim ceilings.
```

---

# Decision tree

```text
A4 method gate fails
  -> repair indexing/quadrature only
  -> do not import real solver states

A4 method gate passes, G0 blocked
  -> build source exporter
  -> no physical interpretation

G0/G1 pass, G2 directional null
  -> A4 is not the missing readout
  -> inspect source decomposition, not opacity fitting

G2 directional pass, constant coefficient transfers
  -> open G4/G5/G6
  -> cadence still blocked

T0 and T1 bracket a reproducible mismatch
  -> open G7 with source-locked candidates

Only a target-fitted law works
  -> reject candidate

W2/P2 changes before split on holdouts
  -> record diagnostic precedence
  -> not causal validation

All read-only gates pass
  -> producer may consider a separate feedback preregistration
```

# Global claim ceiling

```text
NO_PHYSICAL_FORCE_UNTIL_CADENCE_AND_DYNAMIC_PARITY
NO_SCALE_BINDING
NO_UPOR_VALIDATION
NO_DIPOLE_VALIDATION
NO_SYNTHETIC_ORACLE_AS_SOURCE_EVIDENCE
NO_FIRST_OWNER_AUTO_PROMOTION
NO_TARGET_ROOT_FITTING
NO_PRESCRIBED_CAVITY
NO_CANON_PROMOTION
NO_MERGE
```
