# ACTION LAB — CHRYSANTHEMUM EXTERNAL SUPPORT SCALE V1

Date: 2026-08-17
Status: DIAGNOSTIC / PROJECT RECONSTRUCTION / NOT VALIDATION

## Why this test exists

The V14H high-resolution scale study separated two facts:

```text
robust local multiscale concentration
+
global scalar compensation radius coupled to the containing domain.
```

Older project work on Viktor's "Chrysanthemum" already contained a different kind of outer scale:

```text
LOCAL / INNER SIDE:
  continuous material/profile boundary;

EXTERNAL SIDE:
  directional terminal counter-boundary R_term(Omega)
  selected by the first positive external support encountered in each direction.
```

These must not be collapsed into one cavity radius.

## Current hypothesis

```text
MATERIAL CAVITY / COMPENSATION
  = amount ledger of the same continuous positive substrate;
  may possess a local compensation region plus a domain-coupled tail.

EXTERNAL SUPPORT FRONT / CHRYSANTHEMUM
  = angular first-hit/occlusion relation to external formed centres;
  can become locally saturated once every direction has a nearer terminal owner.

GRAVITATIONAL CAPSULE
  = candidate full support/action topology;
  not identical to either density cavity or terminal-depth surface.
```

The key mathematical distinction is nonadditivity after angular closure:

```text
if a direction already has a nearer first-hit owner,
adding more distant bodies does not change R_term(Omega).
```

This supplies an explicit candidate mechanism for `nearest-shell dominance`.

## Exact Scene Lab S10 reproduction

Current S10 is a diagnostic construction:

```text
preset = M0_K4
m = 3
tiers = 4
tier spacing = 1.05
first-hit directions = 16384
body radius is enlarged from the KOU generator default 0.2 to 1.4
mode = CHRYSANTHEMUM
```

The enlarged radius is an inserted closure aid and must not be promoted to a physical constant.

Independent exact-geometry reproduction gives at 16,384 directions:

```text
coverage = 1.0
mean terminal depth ~= 1.2597
terminal-depth RMS / mean ~= 0.4690

first owner by tier:
  tier 1 ~= 70.28%
  tier 2 ~= 28.05%
  tier 3 ~= 1.59%
  tier 4 ~= 0.09%
```

Adding K6 / K8 / K10 after K4 changes none of these terminal-depth statistics in the ordered S10 geometry. The local counter-boundary is therefore already saturated by the nearest tiers in this diagnostic.

Angular-resolution convergence:

```text
directions     coverage     CV(depth)
1024           1.0          ~0.4697
4096           1.0          ~0.4680
16384          1.0          ~0.4690
65536          1.0          ~0.4685
```

Thus the finite lobe amplitude in S10 is not a 16k-ray sampling artifact.

## Important negative control

With the unmodified KOU generator body radius `0.2`, angular closure is absent:

```text
tiers 2  -> coverage ~0.037
tiers 4  -> coverage ~0.097
tiers 6  -> coverage ~0.166
tiers 8  -> coverage ~0.238
tiers 10 -> coverage ~0.306
```

Therefore the current S10 scene demonstrates a sufficient first-hit mechanism, not a source-derived physical closure scale.

## Disorder result

Replacing the ordered antipodal Fibonacci tier directions by random antipodal directions does not automatically erase terminal-depth anisotropy once coverage closes. The exact lobe map changes, but a finite relative depth variation remains.

Interpretation:

```text
DISCRETENESS ALONE -> not sufficient;
FIRST-HIT / OCCLUSION + LOCAL ANGULAR CLOSURE -> sufficient for a finite external front;
ORDERED FCC/FIBONACCI SHAPE -> not yet required for existence of the front.
```

This repairs the earlier caveat that a large isotropic set of external centres could wash angular ripples away.

## New physical delta

```text
A. GLOBAL MATERIAL COMPENSATION SCALE
   can remain environmental/domain coupled;

B. LOCAL EXTERNAL SUPPORT SCALE
   can saturate intrinsically through first-hit ownership;

C. MATERIAL CAVITY != EXTERNAL SUPPORT FRONT.
```

The next physical question is not "what is the cavity radius?" but:

> Does a naturally formed external environment generate local angular closure with a terminal front whose normalized shape and scale remain stable while the global amount-compensation radius continues to grow with the containing domain?

## Required Action Lab controls

The interactive diagnostic must expose:

```text
number of KOU tiers;
external body radius / angular filling;
angular direction count;
ordered antipodal vs randomized antipodal external centres.
```

Readouts:

```text
coverage fraction;
mean terminal depth;
CV terminal depth;
robust q05-q95 lobe amplitude;
owner fraction by tier;
front-change norm K -> K+1.
```

A truly intrinsic terminal front should satisfy, after a finite K_sat:

```text
coverage -> 1;
R_term^(K+1)(Omega) ~= R_term^K(Omega);
relative lobe amplitude remains finite under angular refinement;
K_sat does not increase merely because farther external tiers are added.
```

## Claim ceiling

No claim is made that:

```text
S10 body radius 1.4 is physical;
FCC/HCP is selected by the substrate;
terminal front is total physical force;
material cavity is proved independent of the terminal front;
external support front is a particle boundary;
scale quantization or constants are derived.
```

The result is a mechanism discriminator and a bridge to the current R17 natural-formation solver.