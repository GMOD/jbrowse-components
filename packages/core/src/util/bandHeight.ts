// Default floor for a user-resizable band (an alignments coverage / arc /
// sashimi band, a MAF coverage / conservation band), in px. It exists so the
// drag handle stays grabbable, which is a constraint on dragging, not on what
// config may declare. Bands with their own vocabulary of "too small" pass their
// own. It is also the floor a plot keeps under the bands stacked over it
// (`BandPlot.floor`) while it draws.
export const MIN_BAND_HEIGHT = 20

/** The legal range for one band. Both ends are optional and both are px. */
export interface BandBounds {
  /** Defaults to {@link MIN_BAND_HEIGHT}. */
  min?: number
  /** Defaults to unbounded. A band above a plot should always state one. */
  max?: number
}

/**
 * #api core/util
 * Bound a band height to its legal range — a config value, a menu choice, or a
 * slider position, i.e. anywhere the number is being *stated* rather than
 * dragged.
 *
 * The **floor** keeps the band operable at its smallest: for a drag-resized
 * band that means keeping the handle grabbable, for a menu-sized one it is the
 * height below which its content stops reading. The **ceiling** stops a band
 * from swallowing the plot it sits over — every display floors its plot area at
 * 0, so an unbounded band takes the rows to zero height rather than to a
 * scrollbar, and takes the band's own handle off-screen with them. Bands that
 * share a plot take their ceilings from the stack (`boundStackedBands` in
 * `bandLayout`), since one band's ceiling depends on the others.
 *
 * The bounds differ per band and the rule does not, which is why this takes them
 * rather than each band re-deriving the reasoning — that is how the two
 * `clampBandHeight`s in this repo drifted apart, each ending up with one half of
 * this rule and a doc comment claiming to be the whole of it.
 */
export function boundBandHeight(
  n: number,
  { min = MIN_BAND_HEIGHT, max = Number.POSITIVE_INFINITY }: BandBounds = {},
) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * #api core/util
 * Clamp one *resize* of a drag-resizable band: {@link boundBandHeight}, plus the
 * one rule a resize needs that a stated height does not.
 *
 * The floor becomes `min(bounds.min, current)`, never the bare bound: a band
 * whose config declares it smaller than the floor must stay where it is. Taking
 * the bare floor instead made the *first* drag on such a band jump it up to the
 * floor before honoring the delta. A band at or above the floor is unaffected,
 * one below it can still be dragged but never smaller than it already is, and
 * one dragged back past the floor regains it.
 *
 * The ceiling is not relaxed the same way — a band already over its ceiling is
 * the state the user is trying to escape, so a resize brings it back inside.
 *
 * A drag passes `ResizeHandle` the band's height as `value` and this setter as
 * `onChange`: the handle aims at the height at the press plus the pointer's
 * travel, so the seam waits at a clamp until the pointer comes back to it.
 *
 * @param current - the band's height right now, in px
 * @param target - the height this resize is asking for, in px
 * @param bounds - the band's legal range; for a band in a stack, `max` is
 *   `bandDragBounds` (`bandLayout`), so the plot below keeps its floor
 */
export function clampBandHeight(
  current: number,
  target: number,
  bounds: BandBounds = {},
) {
  const { min = MIN_BAND_HEIGHT } = bounds
  return boundBandHeight(target, { ...bounds, min: Math.min(min, current) })
}

/**
 * #api core/util
 * Heights after growing or shrinking a stack of bands by `distance` px in all:
 * the one rule every whole-stack resize uses. Each band takes its share of the
 * height it has above `floor`, so the tall bands give and take the most, and
 * none goes below `floor`, or below its current height if it already sits under it
 * (the {@link clampBandHeight} rule). Whole pixels, rounded by largest
 * remainder, so the stack moves by exactly the rounded distance.
 */
export function scaleBandHeights(
  heights: number[],
  distance: number,
  floor = MIN_BAND_HEIGHT,
) {
  const floors = heights.map(h => Math.min(h, floor))
  const room = heights.map((h, i) => h - floors[i]!)
  const roomTotal = room.reduce((a, b) => a + b, 0)
  const target = Math.max(0, Math.round(roomTotal + distance))
  const exact = room.map(r =>
    roomTotal > 0 ? (r * target) / roomTotal : target / heights.length,
  )
  const whole = exact.map(e => Math.floor(e))
  let left = target - whole.reduce((a, b) => a + b, 0)
  const byRemainder = exact
    .map((e, i) => ({ i, frac: e - whole[i]! }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of byRemainder) {
    if (left <= 0) {
      break
    }
    whole[i] = whole[i]! + 1
    left -= 1
  }
  return whole.map((w, i) => w + floors[i]!)
}
