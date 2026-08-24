/**
 * The LD matrix is stored banded: a pair (i, j), i > j, is computed and stored
 * only when its separation `i - j` is at most `k`. Pairs further apart are not
 * stored at all, which is what turns the matrix from `n²/2` cells into `n·k`
 * and so makes the cost linear in the SNP count rather than quadratic. It is
 * the same window plink means by `--ld-window`, and a deliberate statement that
 * pairs past `k` are not shown, not an invisible optimization: both LD display
 * modes draw every cell they are given.
 *
 * Rows are ragged — row `i` holds `min(i, k)` entries, its `j` running over
 * `[lo(i), i)`. That raggedness is the point: **at `k >= n - 1` the band covers
 * the whole triangle, `lo` collapses to 0 and `rowStart` to `i*(i-1)/2`, so the
 * layout is bit-identical to the unbanded one it generalizes.** The unwindowed
 * path therefore keeps today's exact indices, and there is no second layout for
 * a reader to get wrong. A rectangular `i*k + (i - j - 1)` would be simpler
 * arithmetic but costs `n*(n-1)` cells at `k = n-1` — twice the triangle — so
 * it would make the common case worse to make the rare case tidier.
 */

import { bandedCellCount } from '@jbrowse/ld-core'

/** First `j` stored in row `i`. */
export function bandRowFirstColumn(i: number, k: number) {
  return i > k ? i - k : 0
}

/**
 * Flat index at which row `i` begins — the exact prefix sum of the row lengths,
 * since `rowStart(i+1) - rowStart(i)` is `min(i, k)` everywhere including at
 * `i = k`, where the triangular head meets the constant-width body.
 *
 * Written through `m = min(i, k)` rather than as two branches because the two
 * are algebraically the same and this way the collapse is visible: while the
 * band still covers the row, `m` is `i` and the second term vanishes, leaving
 * the triangular `i*(i-1)/2`.
 */
export function bandRowStart(i: number, k: number) {
  const m = i < k ? i : k
  return (m * (m - 1)) / 2 + (i - m) * k
}

/**
 * Total cells stored for `n` SNPs at window `k` — algebraically `bandRowStart`
 * at `n`, and asserted against it in `ldBand.test.ts`.
 *
 * Re-exported from the generated twin of `ldUniforms.slang` rather than written
 * here, because this is the one function in the family the kernel also computes:
 * it decides how many cells the dispatch writes, and a host that disagreed would
 * size its buffer differently from the shader filling it. `//! js-export`
 * (adr-051) is what stops the two spellings drifting. The rest of the family is
 * CPU-only — the shader decodes with `decodeBanded` instead, which returns a
 * uint2 and so is outside the emitter's scalar subset.
 */
export const bandCellCount = bandedCellCount

/**
 * The window actually used for `n` SNPs. `maxVariantSeparation` is the config
 * slot, 0 meaning unlimited; clamping to `n - 1` is what makes the collapse
 * above exact rather than merely equivalent, so an unbanded run indexes through
 * the same arithmetic as a banded one.
 */
export function resolveBand(n: number, maxVariantSeparation: number) {
  const full = n > 0 ? n - 1 : 0
  return maxVariantSeparation > 0 && maxVariantSeparation < full
    ? maxVariantSeparation
    : full
}

/**
 * Slot holding the pair (i, j) in a banded `ldValues`, or -1 when the pair is
 * outside the band and was never computed. LD is symmetric, so the argument
 * order does not matter — callers with a canonical i > j and callers reading a
 * transposed pair share this.
 */
export function bandPairIndex(i: number, j: number, k: number) {
  const hi = i > j ? i : j
  const lo = i > j ? j : i
  return hi - lo > k ? -1 : bandRowStart(hi, k) + lo - bandRowFirstColumn(hi, k)
}
