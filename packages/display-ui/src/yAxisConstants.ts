// Vertical inset a plot box reserves above and below itself so the top and
// bottom y-axis labels aren't clipped. Its own module because both index.ts
// (which re-exports computeYTicks) and computeYTicks.ts need it — importing it
// from index.ts would close a cycle.
export const YSCALEBAR_LABEL_OFFSET = 5
