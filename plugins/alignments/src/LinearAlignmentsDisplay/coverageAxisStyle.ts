import { AXIS_GUTTER_WIDTH_PX } from '@jbrowse/wiggle-core'

// Below this band height a full YScaleBar's tick labels overlap each other, so
// both the on-screen axis and the SVG export drop to a single `[0, max]` label
// instead. Shared because the two paths diverged: the export drew a crammed
// scale bar wherever the screen showed the compact label, so shrinking the
// coverage band produced an unreadable figure with no on-screen warning.
export const COMPACT_AXIS_HEIGHT = 30

// Type size of that single label, on both paths.
export const COMPACT_AXIS_FONT_SIZE = 9

// The compact label's text, from the SAME ticks the full axis would have drawn.
// Same wording on screen and in export.
//
// Both ends come off the tick ladder rather than the low end being written as a
// literal 0. The coverage domain does not always start there: a log scale floors
// it at one read (`coverageDepthDomain`) and a `minScore` bound starts it
// wherever the user put it — and `computeCoverageTicks` emits its first tick at
// exactly that baseline, because that is the depth the bars draw flat at. So a
// hardcoded 0 made the axis contradict itself across one drag of the resize
// handle: 30px tall it read "1" at the foot, 29px tall it read "0".
export function compactAxisLabel(ticks: { items: { value: number }[] }) {
  const { items } = ticks
  const min = items[0]?.value ?? 0
  const max = items.at(-1)?.value ?? 0
  return `[${Math.round(min)}, ${Math.round(max)}]`
}

// Width reserved for a full y-axis, and where inside it the spine goes. Both
// come from wiggle-core, beside the `YScaleBar` whose label geometry is what
// makes them the right numbers — this file and MAF's band gutter had each
// arrived at the same 50/45 pair on their own. Re-exported under the local name
// every caller already uses.
export const AXIS_SVG_WIDTH = AXIS_GUTTER_WIDTH_PX
export { leftAxisSpineX } from '@jbrowse/wiggle-core'

// Left edge of the box the read-cloud insert-size (TLEN) axis lays itself out
// in — down mode on the left of the canvas, up mode on the right, both flush
// with the edge. On screen the same box is expressed as the axis <svg>'s
// `left: 0` / `right: 0` with `width: AXIS_SVG_WIDTH`; only an export, which has
// no CSS box to anchor, needs the number. `InsertSizeAxis` places the spine
// inside it, so neither path spells that offset.
export function insertSizeAxisBoxLeft(canvasWidth: number, down: boolean) {
  return down ? 0 : canvasWidth - AXIS_SVG_WIDTH
}

// A grouped axis goes on the right so it clears the group label chips, which
// are anchored at the left edge on both paths. On screen the inset is the
// scrollbar (`right: SCROLLBAR_WIDTH + 2`); an export has no scrollbar, so it is
// just a margin. The compact label is right-aligned in both groupings.
const AXIS_RIGHT_INSET = 4

export function rightAxisSpineX(canvasWidth: number) {
  return canvasWidth - AXIS_RIGHT_INSET - AXIS_SVG_WIDTH
}

export function rightAxisLabelX(canvasWidth: number) {
  return canvasWidth - AXIS_RIGHT_INSET
}
