#!/usr/bin/env python3
"""Export selected governed NPZ values to the VoxelLab browser packet envelope.

The conversion is read-only: source hashes are verified first, numeric arrays
are copied without recalculation, and the source verdict/claim ceiling is kept.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "outputs/R14_V2B3B_R13_F0_RIGID_VOLUME_PACKET_V1"
DEFAULT_OUTPUT = ROOT / "apps/voxellab-web/public/packets/R14_V2B3B_BROWSER_PACKET_V1.json"
DEFAULT_PRODUCER_COMMIT = "96b790f72db2f52d36b0ad6a2aaa26b4a1ec9626"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def array_json(array: np.ndarray) -> Any:
    """Encode governed numeric values; JSON null marks source NaN/Inf exactly."""

    value = np.asarray(array)
    if np.issubdtype(value.dtype, np.floating):
        as_object = value.astype(object)
        as_object[~np.isfinite(value)] = None
        return as_object.tolist()
    return value.tolist()


def convert(output: Path, producer_commit: str) -> dict[str, Any]:
    manifest_path = SOURCE_DIR / "manifest.json"
    packet_path = SOURCE_DIR / "R14_V2B3B_F0_RIGID_VOLUME_SOLID_ANGLE_V1.npz"
    decision_path = ROOT / "data/derived/R14_V2B3B_DECISION_V1.json"
    scene_path = SOURCE_DIR / "scene.json"
    manifest = json_read(manifest_path)
    decision = json_read(decision_path)
    packet_sha = sha256(packet_path)
    if packet_sha != manifest["packet_sha256"]:
        raise RuntimeError("source NPZ SHA256 differs from governed manifest")
    with np.load(packet_path, allow_pickle=False) as arrays:
        body_transforms = array_json(arrays["body_transforms_initial"])
        body_forces = array_json(arrays["force_body"])
        body_torques = array_json(arrays["torque_body"])
        amount_ledger = array_json(arrays["amount_ledger"])
        visual_arrays = {
            "radius_over_source_radius": array_json(arrays["p1_radius_over_source_radius"]),
            "force_cm": array_json(arrays["p1_force_cm"]),
            "force_rigid_volume": array_json(arrays["p1_force_volume"]),
            "force_solid_angle_sh": array_json(arrays["p1_force_sh"]),
            "representation_parity_metrics": array_json(arrays["representation_parity_metrics"]),
        }
    browser_packet = {
        "packet_version": "1.0",
        "producer_commit": producer_commit,
        "packet_sha256": packet_sha,
        "manifest_sha256": sha256(manifest_path),
        "verdict": decision["main_verdict"],
        "claim_ceiling": decision["claim_status"],
        "scene": json_read(scene_path),
        "body_transforms": body_transforms,
        "body_forces": body_forces,
        "body_torques": body_torques,
        "amount_ledger": amount_ledger,
        "diagnostics": {
            "representation_gate": decision["representation_gate"],
            "validation_status": decision["validation_status"],
            "scale_binding_status": decision["scale_binding_status"],
            "canon_promotion_status": decision["canon_promotion_status"],
            "conversion_policy": "VALUE_PRESERVING_JSON_EXPORT_NO_RECOMPUTATION",
            "nonfinite_json_encoding": "SOURCE_NAN_OR_INFINITY_IS_JSON_NULL_WITHOUT_NUMERIC_SUBSTITUTION",
        },
        "visual_arrays": visual_arrays,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(browser_packet, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return browser_packet


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--producer-commit", default=DEFAULT_PRODUCER_COMMIT)
    args = parser.parse_args()
    packet = convert(args.output, args.producer_commit)
    print(json.dumps({
        "output": str(args.output),
        "packet_sha256": packet["packet_sha256"],
        "manifest_sha256": packet["manifest_sha256"],
        "verdict": packet["verdict"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
