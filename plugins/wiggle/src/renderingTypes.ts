// Import-free, so the docs' spec-recipe field map can read the menu labels
// without loading the wiggle-core barrel. [value, menu label]: the config enum
// and the Plot type radios both derive from it.
export const WIGGLE_RENDERINGS = [
  ['xyplot', 'XY plot'],
  ['density', 'Density'],
  ['line', 'Line (step)'],
  ['linecenter', 'Line (interpolated)'],
  ['scatter', 'Scatter'],
] as const

export const WIGGLE_RENDERING_TYPES = WIGGLE_RENDERINGS.map(([value]) => value)
