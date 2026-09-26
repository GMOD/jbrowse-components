// Import-free, so the docs' spec-recipe field map can read the menu labels
// without loading the wiggle-core barrel. [value, menu label]: the Plot type
// radios derive from it, each value one of the five renderings the shaders
// draw, which a config spells as a `mark` and a line's `interpolate`.
export const WIGGLE_RENDERINGS = [
  ['xyplot', 'XY plot'],
  ['density', 'Density'],
  ['line', 'Line (step)'],
  ['linecenter', 'Line (interpolated)'],
  ['scatter', 'Scatter'],
] as const

export type WiggleRendering = (typeof WIGGLE_RENDERINGS)[number][0]

/** What a quantitative plot draws each score as, in Vega-Lite's words. */
export const WIGGLE_MARKS = ['bar', 'point', 'line', 'heatmap'] as const
export type WiggleMark = (typeof WIGGLE_MARKS)[number]

/** How a line joins its scores: held across each bin, or centre to centre. */
export const LINE_INTERPOLATIONS = ['step', 'linear'] as const
export type LineInterpolation = (typeof LINE_INTERPOLATIONS)[number]

/** The rendering a `mark` and its line's `interpolate` draw with. */
export function renderingOf(
  mark: string,
  interpolate: string,
): WiggleRendering {
  switch (mark) {
    case 'point': {
      return 'scatter'
    }
    case 'heatmap': {
      return 'density'
    }
    case 'line': {
      return interpolate === 'linear' ? 'linecenter' : 'line'
    }
    default: {
      return 'xyplot'
    }
  }
}

/** The `mark`, and for a line its `interpolate`, a rendering is written as. */
export function markOf(
  rendering: string,
): { mark: WiggleMark; interpolate?: LineInterpolation } | undefined {
  switch (rendering) {
    case 'xyplot': {
      return { mark: 'bar' }
    }
    case 'scatter': {
      return { mark: 'point' }
    }
    case 'density': {
      return { mark: 'heatmap' }
    }
    case 'line': {
      return { mark: 'line', interpolate: 'step' }
    }
    case 'linecenter': {
      return { mark: 'line', interpolate: 'linear' }
    }
    default: {
      return undefined
    }
  }
}
