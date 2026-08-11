import { stiffnessFromJacobian, symmetricEigenvalues } from "./cpuReference";
import type { Mat3, VolumeFrame } from "./types";

const wrap = (value: number, n: number) => ((value % n) + n) % n;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Exact grid-node specialization of deriveFrameNeutralTolerance. */
export function exactGridNodeNeutralTolerance(volume: VolumeFrame) {
  const [nx, ny, nz] = volume.dimensions;
  const values = new Float64Array(nx * ny * nz * 3);
  let cursor = 0;
  const index = (x: number, y: number, z: number) => {
    const ix = volume.periodic ? wrap(x, nx) : clamp(x, 0, nx - 1);
    const iy = volume.periodic ? wrap(y, ny) : clamp(y, 0, ny - 1);
    const iz = volume.periodic ? wrap(z, nz) : clamp(z, 0, nz - 1);
    return ((iz * ny + iy) * nx + ix) * 3;
  };
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const columns: number[][] = [];
    for (let axis = 0; axis < 3; axis++) {
      const plus = index(x + (axis === 0 ? 1 : 0), y + (axis === 1 ? 1 : 0), z + (axis === 2 ? 1 : 0));
      const minus = index(x - (axis === 0 ? 1 : 0), y - (axis === 1 ? 1 : 0), z - (axis === 2 ? 1 : 0));
      const denominator = 2 * volume.spacing[axis]!;
      columns.push([0, 1, 2].map((component) => (volume.response[plus + component]! - volume.response[minus + component]!) / denominator));
    }
    const jacobian: Mat3 = [
      [columns[0]![0]!, columns[1]![0]!, columns[2]![0]!],
      [columns[0]![1]!, columns[1]![1]!, columns[2]![1]!],
      [columns[0]![2]!, columns[1]![2]!, columns[2]![2]!],
    ];
    const eigenvalues = symmetricEigenvalues(stiffnessFromJacobian(jacobian).stiffness);
    values[cursor++] = Math.abs(eigenvalues[0]);
    values[cursor++] = Math.abs(eigenvalues[1]);
    values[cursor++] = Math.abs(eigenvalues[2]);
  }
  values.sort();
  return Math.max(1e-6, 1e-3 * values[Math.floor(0.95 * (values.length - 1))]!);
}
