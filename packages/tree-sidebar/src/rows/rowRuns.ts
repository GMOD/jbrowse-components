/**
 * Consecutive rows that agree collapse into ONE run, so whatever marks them
 * draws once rather than once per row. Two places need that — the row-label
 * color stripe (`SvgRowLabels`) and the hovered-subtree highlight
 * (`treeDrawingAutorun`) — and both need it for the same two reasons, so the
 * rule is written here once instead of open-coded on each side:
 *
 * - **Correctness at fractional row heights.** A display that fits its rows to a
 *   height has a fractional `effectiveRowHeight`, deliberately never floored
 *   (see `resolveRowHeight`), so a rect per row abuts its neighbour mid-pixel.
 *   A translucent fill then blends over that shared pixel twice and draws a
 *   darker seam at every row boundary — the highlight grows a grid the data
 *   does not have. Merged, the run has two edges instead of N.
 * - **Cost.** A 2000-row clustered track is otherwise 2000 fill calls per hover
 *   frame, or 2000 DOM nodes in a scroll-time SVG overlay, for what is visually
 *   one block.
 *
 * `key` is what makes two adjacent rows the same run, and `undefined` means the
 * row belongs to no run at all — an uncolored row, a row outside the hovered
 * subtree. That is the part worth having a name for: a gap has to stay a gap,
 * never a single run bridging the rows on either side of it, or the mark points
 * at rows it does not describe.
 */
export interface RowRun<K> {
  start: number
  /** exclusive, so `end - start` is the run's row count */
  end: number
  key: K
}

export function rowRuns<T, K>(
  rows: readonly T[],
  key: (row: T, index: number) => K | undefined,
): RowRun<K>[] {
  const runs: RowRun<K>[] = []
  for (const [idx, row] of rows.entries()) {
    const k = key(row, idx)
    if (k === undefined) {
      continue
    }
    // `last.end === idx` is the adjacency test, and it is why a skipped row
    // breaks the run rather than being absorbed into it
    const last = runs.at(-1)
    if (last?.end === idx && last.key === k) {
      last.end = idx + 1
    } else {
      runs.push({ start: idx, end: idx + 1, key: k })
    }
  }
  return runs
}
