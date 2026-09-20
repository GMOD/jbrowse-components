// Vertical inset a plot box reserves above and below itself so the top and
// bottom y-axis labels aren't clipped. Its own module because both index.ts
// (which re-exports computeYTicks) and computeYTicks.ts need it — importing it
// from index.ts would close a cycle.
export const YSCALEBAR_LABEL_OFFSET = 5

// The height one score caption occupies above the plot.
export const SCORE_CAPTION_HEIGHT = 16

// The grey a reference line is drawn in where neither the rule nor its display
// names another.
export const DEFAULT_RULE_COLOR = 'rgb(120,120,120)'
