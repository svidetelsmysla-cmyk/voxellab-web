# WEBGPU EQUILIBRIUM REGIME MAP — G00/G01 RECEIPT

## Verdict

```text
G00_PROVENANCE_PASS
G01_CPU_BASELINE_REPRODUCTION_PASS
```

The owner packet has 47 manifest-verified files. The V14H source NPZ is the
registered `e52ab52b…` artifact from source commit `1794404…`. Rebuilding the
V14J2 viewer produced all 36 frames on the frozen `41×33` plane.

Both finite and nearest-periodic scientific field blobs (`U`, `Fu`, `Fv`,
`lmin`, `lmax`, `curl`) matched the frozen viewer byte-for-byte. Root counts
matched on every frame. The maximum repeated root-position delta was
`1.51e-14` world units and the maximum root-eigenvalue delta was `4.62e-14`.
The generated viewer file hash is intentionally not used as a numerical gate
because the builder embeds elapsed build time.

The seven supplied float64 classifier oracles passed. Density arrays and
component counts were not used to construct the response map or branch IDs.

Claim ceiling remains `ACTION_READOUT_NOT_SOURCE_FORCE`.
