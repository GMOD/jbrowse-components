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
