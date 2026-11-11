/**
 * When a row of rects leaves room for a wider floor (`rowRect.slang`'s
 * SPARSE_RECT_MIN_WIDTH_PX): the lower quartile of the gaps between its rects,
 * measured on the drawn axis at the current zoom, is at least
 * SPARSE_MIN_GAP_PX. The lower quartile, not the median: a row whose rects
 * come in tight clusters has a roomy median and would still fuse its clusters
 * into blocks. The feature display reads it per transcript, over its exons;
 * the mark display per row, over its `rect`s.
 */
export const SPARSE_GAP_QUANTILE = 0.25
export const SPARSE_MIN_GAP_PX = 4

/**
 * The gaps between `spans` once the overlapping and abutting ones merge, in
 * the spans' own unit, ascending.
 */
export function spanGaps(spans: readonly (readonly [number, number])[]) {
  const sorted = spans.toSorted((a, b) => a[0] - b[0])
  const gaps: number[] = []
  let end = sorted[0]?.[1] ?? 0
  for (const [start, stop] of sorted.slice(1)) {
    if (start > end) {
      gaps.push(start - end)
    }
    end = Math.max(end, stop)
  }
  return gaps.sort((a, b) => a - b)
}

/** The lower-quartile gap of ascending `gaps`, undefined where there is none. */
export function quartileGap(gaps: readonly number[]) {
  return gaps[Math.floor((gaps.length - 1) * SPARSE_GAP_QUANTILE)]
}

/** Whether a row whose quartile gap is `gap`, in units of `unitsPerPx`, leaves room. */
export function leavesRoom(gap: number | undefined, unitsPerPx: number) {
  return gap !== undefined && gap / unitsPerPx >= SPARSE_MIN_GAP_PX
}
