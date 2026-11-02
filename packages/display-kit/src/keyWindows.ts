/**
 * The bp a displayed region shows. A key that lists what is present lists what
 * touches one of these (ADR-093), not what was fetched, since the view fetches
 * wider than it shows.
 */
export interface KeyWindow {
  regionIndex: number
  refName: string
  start: number
  end: number
}

/** The windows a view's content blocks show. */
export function keyWindowsOf(
  blocks: readonly {
    displayedRegionIndex?: number
    refName: string
    start: number
    end: number
  }[],
) {
  return blocks.flatMap(({ displayedRegionIndex, refName, start, end }) =>
    displayedRegionIndex === undefined
      ? []
      : [{ regionIndex: displayedRegionIndex, refName, start, end }],
  )
}

/** The windows of each displayed region, keyed by its index. */
export function windowsByRegion(windows: readonly KeyWindow[]) {
  const out = new Map<number, KeyWindow[]>()
  for (const w of windows) {
    const list = out.get(w.regionIndex)
    if (list) {
      list.push(w)
    } else {
      out.set(w.regionIndex, [w])
    }
  }
  return out
}

/** Whether `[start, end)` overlaps any of the spans. */
export function touchesAny(
  spans: readonly { start: number; end: number }[],
  start: number,
  end: number,
) {
  for (const w of spans) {
    if (start < w.end && end > w.start) {
      return true
    }
  }
  return false
}
