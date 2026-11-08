// Vertical inset a plot box reserves above and below itself so the top and
// bottom y-axis labels aren't clipped. Its own module because both index.ts
// (which re-exports computeYTicks) and computeYTicks.ts need it — importing it
// from index.ts would close a cycle.
export const YSCALEBAR_LABEL_OFFSET = 5

// The value scale types a y axis places values by, which the y scale config's
// `type` slot enumerates.
export const VALUE_SCALE_TYPES = ['linear', 'log', 'symlog'] as const
export type ScaleType = (typeof VALUE_SCALE_TYPES)[number]

const SCALE_TYPE_SET: ReadonlySet<string> = new Set(VALUE_SCALE_TYPES)

export function isScaleType(value: string): value is ScaleType {
  return SCALE_TYPE_SET.has(value)
}

// A tick label's font size and how far from the spine it ends, and a
// caption's font size.
export const AXIS_FONT_PX = 10
export const TICK_LABEL_X_PX = 9

// How far in from its gutter's outer edge a caption's rotated baseline sits,
// and the outer band of the gutter the caption then takes: its glyphs, their
// halo and a px before the tick labels.
export const CAPTION_INSET_PX = 8
export const CAPTION_BAND_PX = 13

// The height one score caption occupies above the plot.
export const SCORE_CAPTION_HEIGHT = 16

// The grey a reference line is drawn in where neither the rule nor its display
// names another.
export const DEFAULT_RULE_COLOR = 'rgb(120,120,120)'
