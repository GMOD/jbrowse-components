// Vertical inset a plot box reserves above and below itself so the top and
// bottom y-axis labels aren't clipped. Its own module because both index.ts
// (which re-exports computeYTicks) and computeYTicks.ts need it — importing it
// from index.ts would close a cycle.
export const YSCALEBAR_LABEL_OFFSET = 5

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
