/**
 * The LD matrix is stored banded: a pair (i, j), i > j, has a slot only when
 * its separation `i - j` is at most `k`, the widest pair the file lists. A file
 * written at plink's `--ld-window` then costs `n·k` cells instead of `n²/2`.
 *
 * Rows are ragged: row `i` holds `min(i, k)` entries, its `j` running over
 * `[lo(i), i)`. At `k = n - 1` the band covers the whole triangle and the
 * indices are the triangular `i*(i-1)/2 + j`. A rectangular
 * `i*k + (i - j - 1)` would be simpler arithmetic but costs twice the triangle
 * at `k = n - 1`.
 */

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

/** Total cells stored for `n` SNPs at window `k`. */
export function bandCellCount(n: number, k: number) {
  return n < 2 ? 0 : bandRowStart(n, k)
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
