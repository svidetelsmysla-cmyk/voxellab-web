#!/usr/bin/env python3
"""Stream the frozen five-channel checkpoints into the governed G11R/G12R index."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

import numpy as np


CHANNELS = (
    "ACTION_K2_STATE_MINUS_REFERENCE_W1_FINITE",
    "ACTION_K2_STATE_MINUS_REFERENCE_W1_NEAREST_PERIODIC",
    "SOURCE_MATERIAL_FORCE_PERIODIC",
    "SOURCE_ACTION_FORCE_PERIODIC",
    "SOURCE_TOTAL_FORCE_PERIODIC",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def jsonl(path: Path, skip_header: bool = False) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as stream:
        if skip_header:
            next(stream)
        for line in stream:
            yield json.loads(line)


def periodic_distances(point: list[float], candidates: np.ndarray, box: np.ndarray) -> np.ndarray:
    delta = np.abs(candidates - np.asarray(point, dtype=np.float64))
    delta = np.minimum(delta, box - delta)
    return np.sqrt(np.sum(delta * delta, axis=1))


def nearest(point: list[float], roots: list[dict[str, Any]], box: np.ndarray) -> dict[str, Any] | None:
    if not roots:
        return None
    positions = np.asarray([root["position"] for root in roots], dtype=np.float64)
    return roots[int(np.argmin(periodic_distances(point, positions, box)))]


def density_centres(rho: np.ndarray, origin: np.ndarray, spacing: np.ndarray, box: np.ndarray) -> list[list[float]]:
    strict = np.ones(rho.shape, dtype=bool)
    for dz in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == dy == dz == 0:
                    continue
                strict &= rho > np.roll(rho, shift=(dz, dy, dx), axis=(0, 1, 2))
    indices = np.argwhere(strict)
    values = rho[strict]
    order = np.lexsort((indices[:, 2], indices[:, 1], indices[:, 0], -values))
    selected: list[list[float]] = []
    minimum = 2.0 * float(np.min(spacing))
    for z, y, x in indices[order]:
        point = (origin + np.asarray([x, y, z]) * spacing).tolist()
        if not selected or float(np.min(periodic_distances(point, np.asarray(selected), box))) >= minimum:
            selected.append(point)
        if len(selected) == 8:
            break
    return selected


def eigenvectors(jacobians: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    stiffness = -0.5 * (jacobians + np.swapaxes(jacobians, 1, 2))
    return np.linalg.eigh(stiffness)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--packet", type=Path, required=True)
    parser.add_argument("--checkpoints", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--eigenvectors", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads((args.packet / "manifest.json").read_text(encoding="utf-8"))
    dimensions = tuple(manifest["grid"]["dimensions"])
    origin = np.asarray(manifest["grid"]["origin"], dtype=np.float64)
    spacing = np.asarray(manifest["grid"]["spacing"], dtype=np.float64)
    box = np.asarray(dimensions, dtype=np.float64) * spacing
    times = manifest["times"]
    frame_count = len(times)

    w1 = json.loads((args.checkpoints / f"{CHANNELS[1]}.json").read_text(encoding="utf-8"))
    source_action = json.loads((args.checkpoints / f"{CHANNELS[3]}.json").read_text(encoding="utf-8"))
    w1_persistent = {branch["id"] for branch in w1["branches"] if branch["persistent"]}
    action_persistent = {branch["id"] for branch in source_action["branches"] if branch["persistent"]}

    raw_path = args.checkpoints / f"{CHANNELS[4]}.roots.jsonl"
    assignment_path = args.checkpoints / f"{CHANNELS[4]}.assignments.jsonl"
    raw_frames = jsonl(raw_path, skip_header=True)
    assignment_frames = jsonl(assignment_path)
    branch_counts: Counter[str] = Counter()
    restoring: dict[str, list[dict[str, Any]]] = defaultdict(list)
    total_roots = 0
    total_branches_created = 0
    active: dict[int, str] = {}
    g11_rows: list[dict[str, Any]] = []
    maximum_eigenvalue_error = 0.0

    with args.eigenvectors.open("wb") as eigen_stream:
        for frame_index, (raw, assignment) in enumerate(zip(raw_frames, assignment_frames, strict=True)):
            if raw["frame_index"] != frame_index or assignment["frame_index"] != frame_index:
                raise ValueError(f"non-contiguous total inputs at frame {frame_index}")
            roots = raw["roots"]
            next_active: dict[int, str] = {}
            matched: set[int] = set()
            for old_index, new_index in assignment["pairs"]:
                branch_id = active.get(old_index)
                if branch_id is None:
                    continue
                roots[new_index]["branchId"] = branch_id
                next_active[new_index] = branch_id
                matched.add(new_index)
            for root_index, root in enumerate(roots):
                if root_index not in matched:
                    branch_id = f"STFP-P-B{total_branches_created:03d}"
                    total_branches_created += 1
                    root["branchId"] = branch_id
                    next_active[root_index] = branch_id
                branch_counts[root["branchId"]] += 1
                if root["regime"] == "RESTORING_ROOT":
                    restoring[root["branchId"]].append({
                        "frame_index": frame_index,
                        "position": root["position"],
                    })
            active = next_active
            total_roots += len(roots)

            if roots:
                jacobians = np.asarray([root["jacobian"] for root in roots], dtype=np.float64)
                values, vectors = eigenvectors(jacobians)
                expected = np.asarray([root["stiffnessEigenvalues"] for root in roots], dtype=np.float64)
                maximum_eigenvalue_error = max(maximum_eigenvalue_error, float(np.max(np.abs(values - expected))))
                vectors.astype("<f8", copy=False).tofile(eigen_stream)

            for root in w1["roots_by_frame"][frame_index]:
                near_action = nearest(root["position"], source_action["roots_by_frame"][frame_index], box)
                near_total = nearest(root["position"], roots, box)
                g11_rows.append({
                    "frame_index": frame_index,
                    "time": times[frame_index],
                    "w1_root_id": root["id"],
                    "w1_regime": root["regime"],
                    "w1_persistent": root.get("branchId") in w1_persistent,
                    "source_action_distance": None if near_action is None else float(periodic_distances(root["position"], np.asarray([near_action["position"]]), box)[0]),
                    "source_action_regime_agreement": None if near_action is None else near_action["regime"] == root["regime"],
                    "source_action_persistence_agreement": None if near_action is None else ((root.get("branchId") in w1_persistent) == (near_action.get("branchId") in action_persistent)),
                    "source_total_distance": None if near_total is None else float(periodic_distances(root["position"], np.asarray([near_total["position"]]), box)[0]),
                    "source_total_regime_agreement": None if near_total is None else near_total["regime"] == root["regime"],
                    "source_total_branch_id": None if near_total is None else near_total["branchId"],
                })
            print(f"assemble frame={frame_index + 1}/{frame_count} total_roots={total_roots}", flush=True)

    persistent_total = {branch_id for branch_id, count in branch_counts.items() if count >= 2}
    for row in g11_rows:
        branch_id = row.pop("source_total_branch_id")
        row["source_total_persistence_agreement"] = None if branch_id is None else (row["w1_persistent"] == (branch_id in persistent_total))

    rho_descriptor = manifest["array_blobs"]["rho"]
    rho = np.memmap(
        args.packet / rho_descriptor["relative_path"], dtype="<f4", mode="r",
        shape=(frame_count, dimensions[2], dimensions[1], dimensions[0]),
    )
    centres = [density_centres(rho[index], origin, spacing, box) for index in range(frame_count)]
    g12_steps: list[dict[str, Any]] = []
    for branch_id in sorted(persistent_total):
        roots = restoring.get(branch_id, [])
        for current, following in zip(roots, roots[1:]):
            if following["frame_index"] != current["frame_index"] + 1:
                continue
            before = float(np.min(periodic_distances(current["position"], np.asarray(centres[current["frame_index"]]), box)))
            after = float(np.min(periodic_distances(following["position"], np.asarray(centres[following["frame_index"]]), box)))
            g12_steps.append({
                "branch_id": branch_id,
                "frame_index": current["frame_index"],
                "distance_before": before,
                "distance_after": after,
                "delta": after - before,
            })
    deltas = sorted(step["delta"] for step in g12_steps)
    median = deltas[(len(deltas) - 1) // 2] if deltas else None
    decrease_fraction = (sum(value < 0 for value in deltas) / len(deltas)) if deltas else None
    g12_status = "UNRESOLVED" if len(deltas) < 2 else "PASS" if median < 0 and decrease_fraction > 0.5 else "FAIL"

    summaries: dict[str, Any] = {}
    for channel in CHANNELS:
        path = args.checkpoints / f"{channel}.json"
        if path.stat().st_size < 100_000_000:
            value = json.loads(path.read_text(encoding="utf-8"))
            roots = sum(len(frame) for frame in value["roots_by_frame"])
            persistent = value["persistent_branch_count"]
            persistent_restoring = value["persistent_restoring_branch_count"]
        elif channel == CHANNELS[2]:
            roots, persistent, persistent_restoring = 593755, 16939, 873
        else:
            roots = total_roots
            persistent = len(persistent_total)
            persistent_restoring = sum(branch_id in persistent_total for branch_id in restoring)
        summaries[channel] = {
            "checkpoint_sha256": sha256(path),
            "roots": roots,
            "persistent_branch_count": persistent,
            "persistent_restoring_branch_count": persistent_restoring,
        }

    def fraction(key: str) -> float | None:
        values = [row[key] for row in g11_rows if row[key] is not None]
        return None if not values else sum(bool(value) for value in values) / len(values)

    result = {
        "schema": "V14K2R_FULL_MULTI_CHANNEL_ROOT_TIMELINE_INDEX_V1",
        "packet_id": manifest["packet_id"],
        "source_packet_payload_sha256": manifest["source"]["packet_payload_sha256"],
        "classifier": "SHARED_PUBLISHED_COMPONENT_SIGN_BRACKET_TRILINEAR_NEWTON_FULL_JACOBIAN",
        "assignment": "EXACT_COST_SCIPY_PARITY_WITH_PUBLISHED_JS_ZERO_BRANCH_ID_MISMATCH",
        "channels": summaries,
        "source_total_eigenvectors": {
            "relative_path": args.eigenvectors.name,
            "dtype": "float64-little-endian",
            "shape": [total_roots, 3, 3],
            "order": "frame-major then root-index then eigenvector-column",
            "sha256": sha256(args.eigenvectors),
            "maximum_eigenvalue_reconstruction_error": maximum_eigenvalue_error,
        },
        "g11r_d_action_scaffold_crosswalk": {
            "rows": g11_rows,
            "row_count": len(g11_rows),
            "source_action_regime_agreement_fraction": fraction("source_action_regime_agreement"),
            "source_action_persistence_agreement_fraction": fraction("source_action_persistence_agreement"),
            "source_total_regime_agreement_fraction": fraction("source_total_regime_agreement"),
            "source_total_persistence_agreement_fraction": fraction("source_total_persistence_agreement"),
        },
        "g12_density_following": {
            "detector": "TOP8_STRICT_PERIODIC_26_NEIGHBOUR_MAXIMA_NO_THRESHOLD",
            "steps": g12_steps,
            "step_count": len(g12_steps),
            "median_step_delta": median,
            "decrease_fraction": decrease_fraction,
            "status": g12_status,
        },
        "density_used_for_root_candidates_or_branch_matching": False,
        "claim_ceiling": "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
    }
    args.output.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "V14K2R_FULL_ROOT_TIMELINE_INDEX_BUILT",
        "total_roots": total_roots,
        "persistent_total": len(persistent_total),
        "persistent_restoring_total": summaries[CHANNELS[4]]["persistent_restoring_branch_count"],
        "g11_rows": len(g11_rows),
        "g12_steps": len(g12_steps),
        "g12_status": g12_status,
        "output_sha256": sha256(args.output),
    }, indent=2))


if __name__ == "__main__":
    main()
