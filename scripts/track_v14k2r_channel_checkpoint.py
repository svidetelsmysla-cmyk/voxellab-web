#!/usr/bin/env python3
"""Exact-cost compiled assignment for a frozen V14K2R raw-root JSONL stream."""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from scipy.optimize import linear_sum_assignment


UNMATCHED_COST = 1.5


def root_match_cost(left: dict[str, Any], right: dict[str, Any], stiffness_scale: float) -> float:
    dx = math.dist(left["position"], right["position"]) / 24.0
    dk = math.dist(left["stiffnessEigenvalues"], right["stiffnessEigenvalues"]) / max(stiffness_scale, 1e-30)
    return dx + 0.2 * dk + (0.0 if left["regime"] == right["regime"] else 0.75)


def minimum_cost_assignment(previous: list[dict[str, Any]], roots: list[dict[str, Any]]) -> list[tuple[int, int]]:
    if not previous or not roots:
        return []
    stiffness_scale = max(1e-12, *(abs(value) for root in previous for value in root["stiffnessEigenvalues"]))
    size = max(len(previous), len(roots))
    costs = np.full((size, size), UNMATCHED_COST, dtype=np.float64)
    for row, left in enumerate(previous):
        costs[row, : len(roots)] = [root_match_cost(left, right, stiffness_scale) for right in roots]
    rows, columns = linear_sum_assignment(costs)
    return sorted(
        (int(row), int(column))
        for row, column in zip(rows, columns, strict=True)
        if row < len(previous) and column < len(roots) and costs[row, column] < UNMATCHED_COST
    )


def assignment_job(payload: tuple[int, list[dict[str, Any]], list[dict[str, Any]]]) -> tuple[int, list[tuple[int, int]]]:
    frame_index, previous, roots = payload
    return frame_index, minimum_cost_assignment(previous, roots)


def assignments_for_frames(
    frames: list[list[dict[str, Any]]], channel_id: str, workers: int, cache_path: Path | None
) -> list[list[tuple[int, int]]]:
    cached: list[list[tuple[int, int]]] = []
    if cache_path is not None and cache_path.exists():
        with cache_path.open("r", encoding="utf-8") as stream:
            for expected, line in enumerate(stream):
                item = json.loads(line)
                if item["frame_index"] != expected:
                    raise ValueError(f"non-contiguous assignment cache at frame {expected}")
                cached.append([tuple(pair) for pair in item["pairs"]])
    if len(cached) > len(frames):
        raise ValueError("assignment cache is longer than the frame sequence")
    payloads = [
        (index, frames[index - 1] if index else [], frames[index])
        for index in range(len(cached), len(frames))
    ]
    if workers == 1:
        results = map(assignment_job, payloads)
    else:
        executor = ProcessPoolExecutor(max_workers=workers)
        results = executor.map(assignment_job, payloads, chunksize=1)
    assignments: list[list[tuple[int, int]]] = cached + [[] for _ in range(len(frames) - len(cached))]
    cache_stream = cache_path.open("a", encoding="utf-8", newline="\n") if cache_path is not None else None
    try:
        for frame_index, pairs in results:
            assignments[frame_index] = pairs
            if cache_stream is not None:
                cache_stream.write(json.dumps({"frame_index": frame_index, "pairs": pairs}, separators=(",", ":")))
                cache_stream.write("\n")
                cache_stream.flush()
            print(f"assign channel={channel_id} frame={frame_index + 1}/{len(frames)}", flush=True)
    finally:
        if cache_stream is not None:
            cache_stream.close()
        if workers != 1:
            executor.shutdown(wait=True)
    return assignments


def track(
    frames: list[list[dict[str, Any]]], closure: str, channel_id: str, workers: int,
    assignment_cache: Path | None = None,
) -> list[dict[str, Any]]:
    branches: list[dict[str, Any]] = []
    active: dict[int, int] = {}
    assignments_by_frame = assignments_for_frames(frames, channel_id, workers, assignment_cache)
    for frame_index, roots in enumerate(frames):
        next_active: dict[int, int] = {}
        matched: set[int] = set()
        for old_index, new_index in assignments_by_frame[frame_index]:
            branch_index = active.get(old_index)
            if branch_index is None:
                continue
            root = roots[new_index]
            root["branchId"] = branches[branch_index]["id"]
            branches[branch_index]["roots"].append(root)
            next_active[new_index] = branch_index
            matched.add(new_index)
        for root_index, root in enumerate(roots):
            if root_index in matched:
                continue
            branch_index = len(branches)
            branch_id = f"{'F' if closure == 'FINITE_BOX' else 'P'}-B{branch_index:03d}"
            root["branchId"] = branch_id
            branches.append({"id": branch_id, "roots": [root], "persistent": False})
            next_active[root_index] = branch_index
        active = next_active
    prefix = "".join(word[0] for word in channel_id.split("_"))
    for branch in branches:
        branch["persistent"] = len(branch["roots"]) >= 2
        branch["id"] = f"{prefix}-{branch['id']}"
        for root in branch["roots"]:
            root["branchId"] = branch["id"]
    return branches


def load_raw(path: Path) -> tuple[dict[str, Any], list[list[dict[str, Any]]], list[float]]:
    with path.open("r", encoding="utf-8") as stream:
        header = json.loads(stream.readline())
        frames: list[list[dict[str, Any]]] = []
        neutral: list[float] = []
        for expected, line in enumerate(stream):
            item = json.loads(line)
            if item["frame_index"] != expected:
                raise ValueError(f"non-contiguous raw frame {item['frame_index']} expected {expected}")
            frames.append(item["roots"])
            neutral.append(item["neutral_threshold"])
    if header["schema"] != "V14K2R_RAW_CHANNEL_ROOT_FRAMES_JSONL_V1" or len(frames) != header["frame_count"]:
        raise ValueError("invalid raw-root stream")
    return header, frames, neutral


def build_checkpoint(
    raw_path: Path, output_path: Path, closure: str, workers: int, assignment_cache: Path | None
) -> dict[str, Any]:
    header, frames, neutral = load_raw(raw_path)
    branches = track(frames, closure, header["channel_id"], workers, assignment_cache)
    compact_branches = [
        {
            "id": branch["id"],
            "persistent": branch["persistent"],
            "roots": [{"frameIndex": root["frameIndex"], "regime": root["regime"]} for root in branch["roots"]],
        }
        for branch in branches
    ]
    persistent = sum(bool(branch["persistent"]) for branch in branches)
    restoring = sum(
        bool(branch["persistent"]) and any(root["regime"] == "RESTORING_ROOT" for root in branch["roots"])
        for branch in branches
    )
    output = {
        "schema": "V14K2R_SINGLE_CHANNEL_ROOT_TIMELINE_CHECKPOINT_V1",
        "packet_id": header["packet_id"],
        "channel_id": header["channel_id"],
        "classifier": header["classifier"],
        "neutral_node_specialization": header["neutral_node_specialization"],
        "roots_by_frame": frames,
        "neutral_thresholds": neutral,
        "branches": compact_branches,
        "persistent_branch_count": persistent,
        "persistent_restoring_branch_count": restoring,
        "root_record_fields": [
            "position", "response", "responseNorm", "jacobian", "stiffnessEigenvalues",
            "antisymmetryRatio", "regime", "residualRelative", "branchId",
        ],
        "density_used_for_root_candidates_or_branch_matching": False,
        "claim_ceiling": "SOURCE_FORCE_RESTORING_TOPOLOGY_DIAGNOSTIC_MAXIMUM",
        "assignment_backend": "SCIPY_LINEAR_SUM_ASSIGNMENT_EXACT_COST_PARITY_LOCKED",
    }
    with output_path.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(output, stream, separators=(",", ":"), ensure_ascii=False)
        stream.write("\n")
    return {
        "status": "V14K2R_CHANNEL_TIMELINE_BUILT",
        "channel_id": header["channel_id"],
        "roots": sum(map(len, frames)),
        "persistent": persistent,
        "persistent_restoring": restoring,
    }


def parity(reference_path: Path, workers: int) -> dict[str, Any]:
    reference = json.loads(reference_path.read_text(encoding="utf-8"))
    frames = reference["roots_by_frame"]
    expected = [[root.get("branchId") for root in frame] for frame in frames]
    for frame in frames:
        for root in frame:
            root.pop("branchId", None)
    closure = "FINITE_BOX" if reference["channel_id"].endswith("W1_FINITE") else "NEAREST_PERIODIC"
    branches = track(frames, closure, reference["channel_id"], workers)
    actual = [[root.get("branchId") for root in frame] for frame in frames]
    mismatches = sum(left != right for expected_frame, actual_frame in zip(expected, actual, strict=True) for left, right in zip(expected_frame, actual_frame, strict=True))
    persistent = sum(bool(branch["persistent"]) for branch in branches)
    restoring = sum(bool(branch["persistent"]) and any(root["regime"] == "RESTORING_ROOT" for root in branch["roots"]) for branch in branches)
    return {
        "status": "PASS" if mismatches == 0 else "FAIL",
        "channel_id": reference["channel_id"],
        "root_branch_id_mismatches": mismatches,
        "persistent_expected": reference["persistent_branch_count"],
        "persistent_actual": persistent,
        "persistent_restoring_expected": reference["persistent_restoring_branch_count"],
        "persistent_restoring_actual": restoring,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw")
    parser.add_argument("--output")
    parser.add_argument("--closure", choices=("FINITE_BOX", "NEAREST_PERIODIC"), default="NEAREST_PERIODIC")
    parser.add_argument("--parity-checkpoint")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--assignment-cache")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be positive")
    if args.parity_checkpoint:
        result = parity(Path(args.parity_checkpoint), args.workers)
    else:
        if not args.raw or not args.output:
            parser.error("--raw and --output are required outside parity mode")
        cache = Path(args.assignment_cache) if args.assignment_cache else None
        result = build_checkpoint(Path(args.raw), Path(args.output), args.closure, args.workers, cache)
    print(json.dumps(result, indent=2))
    if result.get("status") != "PASS" and args.parity_checkpoint:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
