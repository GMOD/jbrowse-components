import { bandPairIndex, bandRowFirstColumn } from './ldBand.ts'

/**
 * A dispatch that comes back INCOMPLETE raises no WebGPU error. It is valid, it
 * is submitted, `mapAsync` resolves, and the cells whose workgroups never ran
 * read back as the zeros the buffer was created with — which is a perfectly
 * plausible LD matrix. `pushErrorScope('validation')` in `runGPUCompute` cannot
 * see it, so the display had no way to know.
 *
 * This is not hypothetical. Bit-planing the composite kernel (3f4c3f6ee4) was a
 * fix for exactly it: the byte-loop kernel on a Radeon Pro 5300M, 50,000
 * variants over 2,504 samples, disagreed with its own CPU twin by max |gpu-cpu|
 * of 2.8e-8 at a 200-variant window, 1.2e-2 at 500, then 1.0 at 1000 and 2000 —
 * a zero where the answer is r² = 1. The tell was the timing: the 2000-variant
 * window returned in 411 ms against the 1000-variant window's 17 s, which is not
 * monotonic in the work.
 *
 * The port made the kernel fast enough not to trip it on that hardware. It did
 * not add a detector, so a slower GPU or a larger n trips it again with nothing
 * to notice. This is the detector: recompute a handful of cells on the CPU and
 * compare. The cells cost O(samples) each against a dispatch the caller only
 * reached because `numCells * samples` is at least 500,000, so a dozen of them
 * is a rounding error on the work already done.
 */

// Comfortably above the f32-vs-f64 gap the kernels legitimately show (2.8e-8 to
// 6.0e-7 across every window measured after the port) and comfortably below the
// smallest disagreement a truncated dispatch produced (1.2e-2). A tolerance
// nearer the noise would fall back to the CPU path — 25 minutes at
// 1000-Genomes scale — on an honest rounding difference.
const TOLERANCE = 1e-3

/**
 * Which cells to probe. Weighted to the end of the flat order, because that is
 * where a truncated dispatch leaves its hole: `k = gid.y * rowStride + gid.x`,
 * so the workgroups that fail to run are the last ones. The last slot of all,
 * `(n-1, n-2)`, is always in the set.
 *
 * Each sampled row contributes both of its ends — the cell against the diagonal
 * and the cell at the band's far edge — since a kernel that decodes `k` wrongly
 * rather than dropping it can be right at one end of a row and wrong at the
 * other.
 */
export function ldSpotCheckCells(n: number, band: number) {
  const rows = [
    n - 1,
    n - 2,
    Math.floor((n * 3) / 4),
    Math.floor(n / 2),
    Math.floor(n / 4),
    1,
  ]
  const seen = new Set<number>()
  const cells: { i: number; j: number }[] = []
  for (const i of rows) {
    if (i < 1 || i >= n) {
      continue
    }
    for (const j of [i - 1, bandRowFirstColumn(i, band)]) {
      const slot = bandPairIndex(i, j, band)
      if (slot >= 0 && !seen.has(slot)) {
        seen.add(slot)
        cells.push({ i, j })
      }
    }
  }
  return cells
}

/**
 * The first sampled cell where the GPU's value and a CPU recomputation of the
 * same pair disagree, as a message, or undefined when they all agree.
 *
 * `statsFor` is the caller's CPU estimator for one pair — the same
 * `calculateLDStats*Bits` the fallback path uses, so agreement here is the same
 * agreement `ldStatsParity.test.ts` pins between the kernels and those
 * functions.
 */
export function findLDSpotCheckMismatch(
  values: Float32Array,
  n: number,
  band: number,
  statsFor: (i: number, j: number) => number,
  tolerance = TOLERANCE,
) {
  for (const { i, j } of ldSpotCheckCells(n, band)) {
    const slot = bandPairIndex(i, j, band)
    const got = values[slot]
    if (got === undefined) {
      return `cell (${i}, ${j}) is slot ${slot} of a ${values.length}-cell readback`
    }
    const want = statsFor(i, j)
    if (!(Math.abs(got - want) <= tolerance)) {
      return (
        `cell (${i}, ${j}) reads ${got} where the CPU gives ${want} ` +
        `(tolerance ${tolerance})`
      )
    }
  }
  return undefined
}
