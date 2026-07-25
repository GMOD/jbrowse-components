import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

// Below this band height a full YScaleBar's tick labels overlap each other, so
// both the on-screen axis and the SVG export drop to a single `[0, max]` label
// instead. Shared because the two paths diverged: the export drew a crammed
// scale bar wherever the screen showed the compact label, so shrinking the
// coverage band produced an unreadable figure with no on-screen warning.
export const COMPACT_AXIS_HEIGHT = 30

// The compact label's text. Same wording on screen and in export.
export function compactAxisLabel(maxValue: number) {
  return `[0, ${Math.round(maxValue)}]`
}

// Width reserved for a full y-axis.
export const AXIS_SVG_WIDTH = 50

// YScaleBar grows its ticks and labels away from the spine: orientation 'left'
// grows leftward, so the spine is the axis's right edge. A left-hand axis
// therefore has to inset its spine by the label width, or the labels land at
// negative x, which is what put the exported axis off the image entirely.
export function leftAxisSpineX(left: number) {
  return left + AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET
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
