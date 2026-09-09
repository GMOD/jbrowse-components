// Vertical inset the single-wiggle family reserves above and below the plot so
// the top/bottom y-axis labels aren't clipped. Lives in its own module because
// both index.ts (which re-exports computeYTicks) and computeYTicks.ts need it —
// importing it from index.ts would close a cycle.
export const YSCALEBAR_LABEL_OFFSET = 5

// Left indent of the on-screen y-axis overlay (single-wiggle / manhattan) and of
// multi-wiggle's per-row scalebars. The axis is right-oriented on screen, so its
// labels grow into the plot from here; the indent keeps them clear of the track
// label. Export uses its own anchor (the content left edge).
export const ONSCREEN_AXIS_LEFT_PX = 50
