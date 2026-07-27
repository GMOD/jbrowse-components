// Floor for a user-resizable band (an alignments coverage / arc / sashimi band,
// a MAF coverage / conservation band), in px. It exists so the drag handle stays
// grabbable, which is a constraint on dragging, not on what config may declare.
const MIN_BAND_HEIGHT = 20

/**
 * #api core/util
 * Clamp one resize of a drag-resizable band.
 *
 * The floor is `min(MIN_BAND_HEIGHT, current)`, never the bare constant: a band
 * whose config declares it smaller than the floor must stay where it is. Taking
 * `Math.max(MIN_BAND_HEIGHT, target)` instead made the *first* drag on such a
 * band jump it up to 20 before honoring the delta. A band at or above the floor
 * is unaffected, one below it can still be dragged but never smaller than it
 * already is, and one dragged back past the floor regains it.
 *
 * `ResizeHandle` emits one delta per animation frame, so callers driving a drag
 * pass `current + distance` as the target and read `current` inside the action —
 * a component computing the target from a rendered height drops every tick that
 * lands before React re-renders.
 *
 * @param current - the band's height right now, in px
 * @param target - the height this resize is asking for, in px
 */
export function clampBandHeight(current: number, target: number) {
  return Math.max(Math.min(MIN_BAND_HEIGHT, current), target)
}
