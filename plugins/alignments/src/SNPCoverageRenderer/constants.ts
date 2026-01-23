// Constants for SNPCoverageRenderer

export const INTERBASE_INDICATOR_WIDTH = 7
export const INTERBASE_INDICATOR_HEIGHT = 4.5

// minimum read depth to draw the insertion indicators, below this the
// 'statistical significance' is low
export const MINIMUM_INTERBASE_INDICATOR_READ_DEPTH = 7

// threshold for drawing interbase counts when zoomed out (to avoid skipping
// significant signals due to pixel collision optimization)
export const INTERBASE_DRAW_THRESHOLD = 0.1

export const complementBase = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
} as const

export const fudgeFactor = 0.6
export const SNP_CLICKMAP_THRESHOLD = 0.04
