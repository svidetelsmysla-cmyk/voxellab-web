# VoxelLab Scene Lab V2 performance receipt

This is a local browser engineering benchmark, not scientific validation.

| Gate | Scene | Required configuration | Owner hardware-browser FPS | Result |
|---|---|---:|---:|---|
| B1 | S02 | 2 bodies, 512+512 compute elements | 59.9341 | target met |
| B2 | S03 | 22,528 visible instances | 59.9520 | target met |
| B3 | S05 | 180 KOU bodies (181 including arena) | 59.9460 | target met |
| B4 | S04 | 50 simultaneously movable bodies | 59.9401 | target met |
| B5 | S09 | 16,384 first-hit directions | 59.9580 | target met |

The owner-desktop in-app Chromium exposed a WebGPU adapter and passed the
frozen V1 CPU/WebGPU parity gate with relative delta `5.543e-8`. Scene Lab V2
continues to label its own compute route as an explicit CPU preview.

The reproducible five-minute Playwright memory run used the same local build:

- Stop latency maximum: `0.5 ms`;
- first/last used heap: `22,811,072 / 32,204,423 bytes`;
- growth: `9,393,351 bytes`;
- observed peak: `39,117,547 bytes`;
- bounded-growth classification: `true`;
- console errors / tab crashes: `0 / 0`.

The software-rendered headless browser measured only `4.0562 FPS` for B2 and
`3.1383 FPS` for B5. Those results remain in the raw portability receipt; they
are not hidden or substituted for the task's explicitly requested owner
hardware-browser measurement.
