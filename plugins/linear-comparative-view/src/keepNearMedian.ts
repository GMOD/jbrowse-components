import { preferIncumbent } from './SyntenyFollow/pickFollowFeature.ts'

// how far, in multiples of the anchor's window, an item may sit from the
// length-weighted median and still shape a lane's frame or a launched panel
export const OUTLIER_REACH = 1.5

/**
 * The items within `reachBp` of the length-weighted median item, or all of
 * them when none is.
 *
 * Alignment-level sources carry repeat noise: a handful of short records whose
 * mate lands megabases from the block everything else agrees on, and a
 * min/max frame over them stretches a lane — or a launched panel — across the
 * whole genome. Centering on the length-weighted median and keeping what sits
 * within a window-scaled reach of it drops those; a clean gene table passes
 * through unchanged, since all its placements agree. Shared by the multi-way
 * lane frame and the launch's panel resolution so the two cannot disagree
 * about which hits are the outliers.
 */
export function keepNearMedian<T>(
  items: T[],
  reachBp: number,
  span: (item: T) => { start: number; end: number },
  incumbentCenter?: number,
): T[] {
  if (items.length < 2 || !Number.isFinite(reachBp)) {
    return items
  }
  const mid = (item: T) => {
    const { start, end } = span(item)
    return (start + end) / 2
  }
  const length = (item: T) => {
    const { start, end } = span(item)
    return end - start
  }
  const near = (center: number) =>
    items.filter(item => Math.abs(mid(item) - center) <= reachBp)
  const weightNear = (center: number) =>
    near(center).reduce((sum, item) => sum + length(item), 0)
  const median = weightedMedian(
    items.map(item => ({ value: mid(item), weight: length(item) })),
  )
  // a window whose placements sit in two blocks a reach apart has a median
  // that hops between them as the window pans; the block kept last time keeps
  // its place until the other clearly outweighs it
  const center = preferIncumbent(
    { center: median, overlap: weightNear(median) },
    incumbentCenter === undefined
      ? undefined
      : { center: incumbentCenter, overlap: weightNear(incumbentCenter) },
  )!.center
  const kept = near(center)
  return kept.length ? kept : items
}

/**
 * The value at the halfway point of the summed weights — the median an item's
 * length gets a vote in, rather than one where every item counts once.
 */
export function weightedMedian(samples: { value: number; weight: number }[]) {
  const sorted = [...samples].sort((a, b) => a.value - b.value)
  const total = sorted.reduce((sum, s) => sum + s.weight, 0)
  let acc = 0
  for (const sample of sorted) {
    acc += sample.weight
    if (acc >= total / 2) {
      return sample.value
    }
  }
  return 0
}
