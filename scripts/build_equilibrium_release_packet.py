#!/usr/bin/env python3
"""Build the deterministic WebGPU equilibrium-map review packet."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "public/receipts/WEBGPU_EQ_MAP_MANIFEST_SHA256.json"
PACKAGE_PATH = ROOT / "reports/implementation/WEBGPU_EQUILIBRIUM_REGIME_MAP_V1_PACKAGE.zip"
PACKAGE_RECEIPT_PATH = ROOT / "public/receipts/WEBGPU_EQ_MAP_PACKAGE_SHA256_V1.json"

EXACT_FILES = (
    "package.json",
    "playwright.webgpu.config.ts",
    "vite.config.ts",
    "scripts/buildEquilibriumRootTimeline.ts",
    "scripts/build_equilibrium_release_packet.py",
)

TREE_ROOTS = (
    "public/packets/webgpu-equilibrium-regime-map-v1",
    "src/actionLab/equilibriumGpu",
)

GLOBS = (
    "public/receipts/WEBGPU_EQ_MAP_*.json",
    "reports/implementation/WEBGPU_EQ_MAP_*.md",
    "reports/implementation/WEBGPU_EQUILIBRIUM_*.png",
    "reports/implementation/WEBGPU_EQUILIBRIUM_*.gif",
    "src/actionLab/EquilibriumRegimeMapPanel.ts",
    "src/actionLab/equilibriumRegimeMap.css",
    "src/actionLab/main.ts",
    "tests/equilibriumGpu*.test.ts",
    "tests/e2e/equilibrium-regime-map.spec.ts",
    "tests/gpu-runner/equilibrium-webgpu-parity.spec.ts",
)

EXCLUDED = {
    MANIFEST_PATH,
    PACKAGE_PATH,
    PACKAGE_RECEIPT_PATH,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect_files() -> list[Path]:
    files: set[Path] = set()
    for relative in EXACT_FILES:
        files.add(ROOT / relative)
    for relative in TREE_ROOTS:
        files.update(path for path in (ROOT / relative).rglob("*") if path.is_file())
    for pattern in GLOBS:
        files.update(path for path in ROOT.glob(pattern) if path.is_file())

    missing = sorted(str(path.relative_to(ROOT)) for path in files if not path.exists())
    if missing:
        raise FileNotFoundError(f"release inputs are missing: {missing}")
    return sorted((path for path in files if path not in EXCLUDED), key=lambda p: p.as_posix())


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_deterministic_zip(paths: list[Path]) -> None:
    PACKAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(PACKAGE_PATH, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            relative = path.relative_to(ROOT).as_posix()
            info = ZipInfo(relative, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            archive.writestr(info, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)


def main() -> None:
    inputs = collect_files()
    manifest = {
        "schema": "VOXELLAB_WEBGPU_EQ_MAP_RELEASE_MANIFEST_V1",
        "claim_ceiling": "ACTION_READOUT_NOT_SOURCE_FORCE",
        "decision": "WEBGPU_INSTRUMENT_PASS_ONLY",
        "files": [
            {
                "path": path.relative_to(ROOT).as_posix(),
                "sha256": sha256(path),
                "size_bytes": path.stat().st_size,
            }
            for path in inputs
        ],
    }
    write_json(MANIFEST_PATH, manifest)

    package_inputs = sorted([*inputs, MANIFEST_PATH], key=lambda p: p.as_posix())
    write_deterministic_zip(package_inputs)
    write_json(
        PACKAGE_RECEIPT_PATH,
        {
            "schema": "VOXELLAB_WEBGPU_EQ_MAP_PACKAGE_SHA256_V1",
            "artifact": PACKAGE_PATH.relative_to(ROOT).as_posix(),
            "sha256": sha256(PACKAGE_PATH),
            "size_bytes": PACKAGE_PATH.stat().st_size,
            "manifest": MANIFEST_PATH.relative_to(ROOT).as_posix(),
            "manifest_sha256": sha256(MANIFEST_PATH),
            "file_count": len(package_inputs),
            "decision": "WEBGPU_INSTRUMENT_PASS_ONLY",
            "claim_ceiling": "ACTION_READOUT_NOT_SOURCE_FORCE",
        },
    )

    print(f"manifest_sha256={sha256(MANIFEST_PATH)}")
    print(f"package_sha256={sha256(PACKAGE_PATH)}")
    print(f"package_size_bytes={PACKAGE_PATH.stat().st_size}")
    print(f"file_count={len(package_inputs)}")


if __name__ == "__main__":
    main()
