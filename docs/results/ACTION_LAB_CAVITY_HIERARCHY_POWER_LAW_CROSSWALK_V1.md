# ACTION LAB — CAVITY HIERARCHY POWER-LAW CROSSWALK V1

Date: 2026-08-17
Status: ANALYTIC PROJECT DERIVATION FROM HISTORICAL S30 BOOKKEEPING LAW / NOT VALIDATION

## Historical starting point

The old S30 hierarchy bookkeeping introduced

```text
beta_l = V_cav,l / V_core,l
f_cav,l = beta_l / (1 + beta_l)
phi_eff,l = 1 / (1 + beta_l) = 1 - f_cav,l.
```

For one hierarchy transition, without shared-cavity merge correction,

```text
1 + beta_(l+1) = (1 + beta_l) / Phi_l.
```

Therefore the same law can be written much more transparently as

```text
1 - f_cav,l+1 = Phi_l * (1 - f_cav,l).
```

This is the exact cavity-share recursion implied by the historical bookkeeping convention.

Interpretation:

```text
the next level inherits all lower-level cavity
+
adds the inter-package cavity implied by Phi_l.
```

## Constant local similarity

If every level repeats the same effective filling factor

```text
Phi_l = Phi,
```

then after `n` hierarchy steps

```text
1 - f_cav,n = (1 - f_cav,0) * Phi^n
```

or

```text
f_cav,n = 1 - (1 - f_cav,0) * Phi^n.
```

Thus the *non-cavity* share decays geometrically/exponentially with the hidden level index, while the cumulative cavity share approaches one.

This is compatible with local geometric similarity at every step: each transition can use the same `Phi`, yet cumulative cavity dominance increases because old cavities are inherited.

## From level exponential to physical power law

If the characteristic linear scale is also geometric across levels,

```text
L_n = L_0 * b^n,
```

then eliminating the hidden level index gives

```text
1 - f_cav(L)
= (1 - f_cav,0) * (L/L_0)^[ln(Phi)/ln(b)].
```

Define

```text
alpha = -ln(Phi)/ln(b) > 0   for 0<Phi<1 and b>1.
```

Then

```text
1 - f_cav(L) ~ L^(-alpha)
```

and

```text
f_cav(L) = 1 - C * L^(-alpha).
```

The cavity fraction itself is therefore a saturating approach to one; the occupied/core share is the pure power-law quantity.

This is a concrete project instance of the general algebra:

```text
exponential/geometric size growth in level index
+
exponential/geometric survival of occupied fraction in level index
->
power law after eliminating the hidden level index.
```

## Scale-dimension equivalence

The enclosing volume scales as `L^3`. If its cumulative core/occupied fraction is

```text
phi_core(L) = 1 - f_cav(L) ~ L^(-alpha),
```

then cumulative lower-level core volume scales as

```text
V_core(L) ~ L^3 * L^(-alpha) = L^(3-alpha).
```

Therefore define the hierarchy core scale dimension

```text
D_core = 3 - alpha
       = 3 + ln(Phi)/ln(b).
```

Equivalently,

```text
f_cav(L) = 1 - C * L^(D_core-3).
```

For an exactly self-similar parent made from `m` equal child packages with scale ratio `b`,

```text
Phi = m/b^3,
```

and therefore

```text
D_core = ln(m)/ln(b).
```

So the historical cavity recursion, the standard self-similar dimension formula, and the new scale-dimension curve are three forms of the same multiplicative hierarchy mathematics — **if** the solver independently produces stable `Phi`, `b`, and level objects.

## Merge/shared-cavity correction

Historical S30 also allowed

```text
beta_(l+1)
= beta_l
+ (1+beta_l)*(1/Phi_l - 1)
+ delta_merge,l+1.
```

In occupied-share form `g_l = 1-f_cav,l = 1/(1+beta_l)`:

```text
g_(l+1)
= Phi_l * g_l / [1 + delta_merge,l+1 * Phi_l * g_l].
```

Thus exact pure power scaling is expected only when merge/bridge corrections are negligible, scale-independent after normalization, or themselves approach a stable renormalized rule.

Positive `delta_merge` increases cavity dominance; negative overlap/union correction reduces it.

## Relationship to current V14H high-resolution result

Do **not** equate historical geometric `V_cav` with current source-direct `M_minus` or with the moment dimensions `D_q`.

The current V14H result establishes robust multiscale concentration of density relief and domain coupling of a global scalar compensation radius. It does not directly measure the S30 hierarchy cavity volume.

What it does provide is a compatible diagnostic language:

```text
S30 hierarchy law:
  cumulative occupied fraction across discrete levels;

current scale-dimension analysis:
  how source-direct density relief fills containing scales;

future R17 test:
  measure both on naturally formed level objects and ask whether the independently measured exponents coincide.
```

## Direct prospective falsifier for R17

For each pair of naturally produced adjacent levels `l -> l+1`, measure independently:

```text
1. characteristic emergent scale L_l and L_(l+1);
2. b_l = L_(l+1)/L_l;
3. lower-package filling factor Phi_l inside the next-level envelope;
4. direct cavity/core share f_cav,l and f_cav,l+1 from a topology-first material assignment;
5. shared-cavity/bridge correction delta_merge if required.
```

Then predict without fitting:

```text
1 - f_pred,l+1 = Phi_l * (1 - f_cav,l)
```

(or the merge-corrected form) and compare with the directly measured next-level share.

The scale exponent is independently predicted as

```text
alpha_l = -ln(Phi_l)/ln(b_l),
D_pred,l = 3 - alpha_l.
```

The hierarchy hypothesis becomes strong only if repeated natural transitions show:

```text
measured cavity recursion ~= predicted cavity recursion
+
D_direct ~= D_pred
+
Phi_l and b_l approach stable level-to-level values or a stable cycle.
```

This test contains no fitted `eta` and no manually selected power exponent.

## Relation to Chrysanthemum/external support

Growing cumulative cavity dominance means the effective occupied fraction of formed packages decreases with hierarchy scale. Therefore a self-similar external terminal-owner front is **not automatically** implied by cavity growth.

Two distinct possibilities must be tested:

```text
A. constant a/s across levels:
   normalized external first-owner geometry is scale-similar;

B. cavity dominance changes a/s or effective filling:
   R_term / R_core changes systematically with level.
```

Thus the cavity law supplies a possible driver of changing external-support range rather than proving a constant scale resonance.

## Claim ceiling

Historical S30 established arithmetic/bookkeeping consistency only. It did not prove physical FCC packing, natural field hierarchy, cavity-volume ontology, atom structure, force support, source, mass, or screening.

The power-law crosswalk here is an exact mathematical consequence of that declared recursion plus geometric level scaling. Its physical status remains a prospective R17 discriminator.