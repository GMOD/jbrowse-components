/**
 * A dispatch that comes back incomplete raises no WebGPU error: the cells its
 * workgroups never reached read back as the zeros the buffer started with,
 * and a zero distance is a perfectly plausible one — hclust would merge those
 * samples first, at height 0. The LD matrix kernel met exactly this on a
 * Radeon Pro 5300M and grew a spot check of its own before that estimator was
 * retired; this is the same detector for the distance build. A handful of pairs recomputed in f64 cost O(V) each
 * against a dispatch the caller only reached past a work gate of 10^9
 * pair-elements.
 */

// Well above the f32 rounding the kernel legitimately shows (its blocked
// Kahan sum holds a few ulps; 3.6e-5 relative was the unblocked worst case at
// 22,000 fractional columns) and well below a dropped cell, which reads 0.
const TOLERANCE = 1e-4

/**
 * Corners and midpoints of the upper triangle, the last cell of all included:
 * a 2D dispatch that runs short leaves its hole at the high workgroup ids,
 * and a kernel indexing wrongly rather than dropping cells is right at one
 * end of a row and wrong at the other.
 */
export function distanceSpotCheckCells(n: number) {
  const mid = Math.floor(n / 2)
  const candidates = [
    [0, 1],
    [0, n - 1],
    [n - 2, n - 1],
    [1, n - 2],
    [mid, mid + 1],
    [Math.floor(n / 4), Math.floor((3 * n) / 4)],
    [0, mid],
    [mid, n - 1],
  ]
  const seen = new Set<number>()
  const cells: { i: number; j: number }[] = []
  for (const [i, j] of candidates) {
    if (i! >= 0 && j! > i! && j! < n && !seen.has(i! * n + j!)) {
      seen.add(i! * n + j!)
      cells.push({ i: i!, j: j! })
    }
  }
  return cells
}

export function euclideanDistance(a: ArrayLike<number>, b: ArrayLike<number>) {
  let sum = 0
  for (let k = 0; k < a.length; k++) {
    const d = a[k]! - b[k]!
    sum += d * d
  }
  return Math.sqrt(sum)
}

/**
 * The first sampled cell where the GPU's distance and an f64 recomputation
 * of the same pair disagree, as a message, or undefined when they all agree.
 */
export function findDistanceSpotCheckMismatch(
  values: Float32Array,
  rows: ArrayLike<number>[],
  tolerance = TOLERANCE,
) {
  const n = rows.length
  if (values.length !== n * n) {
    return `readback holds ${values.length} cells, not ${n * n}`
  }
  for (const { i, j } of distanceSpotCheckCells(n)) {
    const got = values[i * n + j]!
    const want = euclideanDistance(rows[i]!, rows[j]!)
    if (!(Math.abs(got - want) <= tolerance * Math.max(1, want))) {
      return `cell (${i}, ${j}) reads ${got} where the CPU gives ${want} (tolerance ${tolerance})`
    }
  }
  return undefined
}
