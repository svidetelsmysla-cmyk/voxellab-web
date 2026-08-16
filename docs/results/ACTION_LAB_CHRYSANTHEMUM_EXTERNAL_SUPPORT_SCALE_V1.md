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

## Power geometry -> exponential closure bridge

The existing KOU generator contains a useful exact scale relation. Tier `k` has

```text
N_k = 2 m k^2
r_k = s (k+1)
```

with current diagnostic `m=3`, `s=1.05`.

For a positive external sphere of radius `a` observed from the centre, its exact solid-angle fraction is

```text
f_Omega(a,r) = [1 - sqrt(1-(a/r)^2)] / 2
```

and for `a << r`:

```text
f_Omega ~ a^2/(4 r^2).
```

Therefore the raw, overlap-unaware angular opportunity supplied by one tier is

```text
Lambda_k = N_k f_Omega(a,r_k)
```

and asymptotically

```text
Lambda_k -> m a^2/(2 s^2) = constant.
```

This is the exact cancellation:

```text
number of possible external owners per tier ~ r^2
x
one-owner solid-angle footprint ~ 1/r^2
=
approximately scale-independent raw angular opportunity per tier.
```

This is **not** a force law and not a transport flux. It is pure solid-angle geometry plus the KOU centre-count rule.

First-hit/occlusion then changes the problem. A direction already owned by a nearer tier cannot be owned again by a farther one. Define the remaining open angular fraction after tier `K` as

```text
S_K = 1 - coverage_K.
```

If successive shells supply a roughly constant effective angular closure hazard `h`, then

```text
S_K ~ exp(-h K).
```

The ordered diagnostic with 8,192 angular samples gives, over K=1..10:

```text
support radius a     fitted h      R^2 of ln(S_K) vs K
0.2                  ~0.0400       ~0.9917
0.4                  ~0.1708       ~0.9929
0.6                  ~0.3367       ~0.9964
```

For larger support radii the front closes in only a few tiers and the finite-K exponential approximation ceases to be the useful asymptotic description. At `a=1.4` the open fractions are approximately

```text
K1: 0.2982
K2: 0.0167
K3: 0.00073
K4: 0
```

so the diagnostic reaches exact sampled angular closure by K4.

This gives the project a concrete place where power and exponential laws coexist without contradiction:

```text
single angular footprint:
  inverse-square / power geometry;

tier population:
  compensating square growth;

first-owner survival over repeated tiers:
  approximately exponential in tier count.
```

## Constant external-centre density and the terminal-ownership length

The same KOU asymptotics reveal why the `k^2` shell count is physically interesting as a representation of a homogeneous external population rather than just a numerical recipe.

For shell thickness `dr ~= s`, shell volume is approximately

```text
dV_shell ~= 4 pi r_k^2 s.
```

With `N_k ~= 2 m k^2` and `r_k ~= s k`, the represented centre number density tends to

```text
n_c ~= N_k / dV_shell
    ~= m / (2 pi s^3),
```

which is independent of radius.

A static geometric line-of-direction encounter opportunity for finite centres has area scale

```text
Sigma_geom ~ pi a^2.
```

The associated terminal-ownership length scale is therefore, at the level of this geometric approximation,

```text
ell_term ~ 1 / (n_c Sigma_geom)
         ~ 2 s^3 / (m a^2).
```

Again, `ell_term` is **not** introduced as a corpuscular mean-free-path. It is a compact way of describing the terminal-depth statistics of a static first-owner geometry.

This gives a very strong hierarchy clue. If a natural next level rescales object radius and characteristic spacing together,

```text
a' = b a
s' = b s,
```

then

```text
ell_term' = b ell_term
```

and consequently

```text
ell_term / a = invariant
```

provided the dimensionless filling/shape statistics remain similar.

Equivalent packing-fraction form:

```text
n_c a^3 ~ phi
Sigma_geom ~ C_shape a^2
=>
ell_term / a ~ 1/(C_shape phi).
```

This is a concrete possible mechanism for the old qualitative statement that the external counter-boundary grain can remain calibrated to the clump scale without requiring a fundamental voxel size of space.

It also sharpens the proposed `scale resonance` concept. A level can reproduce the *dimensionless* external support geometry of another level when its object-size / spacing / angular-shape ratios repeat. Absolute lengths may change while the normalized terminal front does not.

## Link to the “two exponentials -> power law” clue

The shell result above does not itself create a new power law in physical distance; KOU tiers are linearly spaced here.

But it identifies the exact algebra that should be tested if a **natural discrete hierarchy** later has geometric level spacing:

```text
L_j = L_0 b^j
P_j = P_0 s^j
```

where `P_j` is an independently measured normalized angular mode, survival fraction, or other level-to-level quantity. Eliminating the hidden level index `j` gives

```text
P(L) = const * L^[ln(s)/ln(b)].
```

Thus “two exponentials -> power law” has a precise possible carrier in the project:

```text
geometric growth of physical scale across levels
+
multiplicative survival/transfer of a relational mode across levels.
```

No exponent, especially `-2`, is derived here. A `-2` inter-level exponent would require the independent relation `ln(s)/ln(b)=-2`.

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

The interactive diagnostic exposes:

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
front-change norm K -> K+1;
raw solid-angle budget by shell;
open-sky survival and effective shell hazard;
terminal scale normalized by support-object size.
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
scale quantization or constants are derived;
observed shell hazard is a physical collision/transport process;
a gravitational exponent is derived from the tier law;
self-similar external support is naturally selected by V14H or R17.
```

The result is a mechanism discriminator and a bridge to the current R17 natural-formation solver.