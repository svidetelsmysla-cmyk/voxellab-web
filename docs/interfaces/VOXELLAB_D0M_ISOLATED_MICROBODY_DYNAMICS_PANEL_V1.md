# VoxelLab D0M isolated independent-microbody dynamics panel V1

## Purpose

The D0M panel is a read-only governed playback of the first dynamic gate after
D0S static parity.

```text
one isolated group of equal positive microbodies;
each microbody has an independent position and velocity state;
zero initial velocity;
direct positive central pair branch only;
free expansion;
shape evaluated after division by current R_rms.
```

The browser does not rerun the O(N²) solver and does not reconstruct missing
particle trajectories. It reads:

```text
public/packets/R13_D0M_ISOLATED_MICROBODY_DYNAMICS_PUBLIC_V1.json
```

## Source packet

```text
source solver commit = d68e6e16954c21b19a32d0c7a90a5944d779fc44;
workflow run = 31081181415;
job = 92550136008;
artifact = 8959521137;
full receipt SHA256 = 3a5df4536699d244eafe3bd0d9ef85809bddf1b71928ce17967b6fcd34176078.
```

The public packet contains only bounded metrics, milestone states, gates,
operator audit and provenance. It contains no private paths or missing particle
positions.

## Display structure

The interface deliberately separates size and shape.

### Size panel

```text
R_rms(tau)/R_rms(0)
```

is displayed versus relational dimensionless time `tau` at the first completed
steps crossing the registered expansion factors:

```text
1.10;
1.25;
1.50.
```

The size increase is expected for the free direct-repulsion control and is not
labelled instability or equilibrium.

### Normalized-shape panel

The following are displayed against expansion:

```text
A = normalized shape-tensor anisotropy;
T = tangential kinetic fraction;
H = residual from the best homologous radial velocity field.
```

Lower `A`, `T` and `H` mean a more spherical/radial/homologous normalized
response. They do not establish a self-held object.

### Shape-tensor proxy

The selected milestone shows an ellipse derived from the three eigenvalues of
the normalized second-moment tensor.

This is explicitly:

```text
SHAPE_TENSOR_PROXY;
NOT_PARTICLE_SURFACE;
NOT_SOLVED_CLUMP_CONTOUR.
```

The dashed circle is the isotropic second-moment reference.

### Refinement panel

At expansion `1.50`, the panel compares:

```text
N24;
N48;
N96;
N192.
```

for initial/final anisotropy, anisotropy drift, `T`, `H` and energy drift.

### Audit panels

The interface exposes:

```text
G01-G18 exact gate matrix;
rotation covariance;
particle-order covariance;
N96 timestep refinement;
operator ingredient firewall;
source commit and receipt hashes;
claim ceiling and D0C gate status.
```

## Operator boundary

Present in D0M:

```text
direct positive central pair interaction;
paired action-reaction evaluation;
independent state per microbody;
symplectic Euler in relational dimensionless time.
```

Explicitly absent:

```text
damping;
softening;
distance cutoff;
force cap;
velocity clipping;
contact;
Upor;
radial-shell restoration;
neighbour rest lengths;
shape matching;
background screening in motion;
redirection in motion;
physical seconds.
```

## Verdict

```text
D0M_DIRECT_PAIRWISE_NORMALIZED_SPHERE_PRESERVATION_PASS
D0C = OPEN_AFTER_D0M_PASS
```

Claim ceiling:

```text
DIRECT_PAIRWISE_DIMENSIONLESS_ISOLATED_MICROBODY_DYNAMICS_CONTROL_ONLY
```

## Interpretation ceiling

The panel may show:

```text
free expansion occurred;
all registered bodies moved outward;
normalized anisotropy decreased through expansion;
tangential and non-homologous residuals decreased with N;
rotation, permutation and timestep controls passed.
```

The panel may not claim:

```text
self-held clump;
full Viktor dynamic operator;
physical field ontology of microbodies;
background or redirection motion closure;
contact or Upor;
physical force or cadence;
scale binding;
dipole stability;
validation or canon promotion.
```

## Firewalls

```text
READ_ONLY_PACKET_PLAYBACK
NO_BROWSER_PHYSICS_RECOMPUTATION
NO_PARTICLE_ANIMATION_WITHOUT_EXPORTED_STATES
NO_SHAPE_PROXY_AS_SURFACE
NO_DIRECT_PAIRWISE_CONTROL_AS_FULL_VIKTOR_LAW
NO_PHYSICAL_FORCE
NO_UPOR_CLAIM
NO_DIPOLE_VALIDATION
NO_SCALE_BINDING
NO_VALIDATION
NO_CANON_PROMOTION
NO_MERGE
```
