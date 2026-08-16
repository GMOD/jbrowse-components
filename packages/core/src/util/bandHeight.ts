// Default floor for a user-resizable band (an alignments coverage / arc /
// sashimi band, a MAF coverage / conservation band), in px. It exists so the
// drag handle stays grabbable, which is a constraint on dragging, not on what
// config may declare. Bands with their own vocabulary of "too small" pass their
// own (the variant lane's 8 is where a record stops reading as a mark).
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
 * scrollbar, and takes the band's own handle off-screen with them.
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
 * `ResizeHandle` emits one delta per animation frame, so callers driving a drag
 * pass `current + distance` as the target and read `current` inside the action —
 * a component computing the target from a rendered height drops every tick that
 * lands before React re-renders.
 *
 * @param current - the band's height right now, in px
 * @param target - the height this resize is asking for, in px
 * @param bounds - the band's legal range; `max` should be derived from the
 *   display height so the plot below cannot be squashed to nothing
 */
export function clampBandHeight(
  current: number,
  target: number,
  bounds: BandBounds = {},
) {
  const { min = MIN_BAND_HEIGHT } = bounds
  return boundBandHeight(target, { ...bounds, min: Math.min(min, current) })
}
