# VoxelLab browser packet schema v1

## Purpose

The browser packet is a JSON inspection envelope for selected values from an
already governed repository packet. It is not a new solver output and cannot
raise the source verdict.

## Required fields

| Field | Type | Meaning |
|---|---|---|
| `packet_version` | string | Exactly `1.0` |
| `producer_commit` | string | Commit that produced the source governed packet |
| `packet_sha256` | string | SHA-256 of the original governed NPZ |
| `manifest_sha256` | string | SHA-256 of the original manifest |
| `verdict` | string | Original governed verdict |
| `claim_ceiling` | string | Maximum permitted interpretation |
| `scene` | object | Original packet scene metadata |
| `body_transforms` | array | Selected source transforms |
| `body_forces` | array | Selected source force values |
| `body_torques` | array | Selected source torque values |
| `amount_ledger` | array | Original amount ledger |
| `diagnostics` | object | Gate and non-promotion status |
| `visual_arrays` | object | Selected display arrays copied without recalculation |

## Non-finite JSON values

Strict JSON has no NaN or infinity token. A non-finite value in the source NPZ
is encoded as JSON `null` and declared by:

```text
diagnostics.nonfinite_json_encoding =
  SOURCE_NAN_OR_INFINITY_IS_JSON_NULL_WITHOUT_NUMERIC_SUBSTITUTION
```

The converter never replaces it with a finite number.

## Conversion

`tools/voxellab_web/export_browser_packet.py` verifies the governed NPZ hash
against its manifest before reading. It copies only the registered fields and
uses strict `allow_nan=False` serialization. The browser validates the envelope
and displays it without invoking either preview backend.
