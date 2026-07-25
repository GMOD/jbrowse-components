// Vertical inset the single-wiggle family reserves above and below the plot so
// the top/bottom y-axis labels aren't clipped. Lives in its own module because
// both index.ts (which re-exports computeYTicks) and computeYTicks.ts need it —
// importing it from index.ts would close a cycle.
export const YSCALEBAR_LABEL_OFFSET = 5
