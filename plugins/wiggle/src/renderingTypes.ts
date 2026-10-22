// Import-free, so the docs' spec-recipe field map can read the menu labels
// without loading the wiggle-core barrel. [value, menu label]: the Plot type
// radios derive from it, each value one of the five renderings the shaders
// draw, which a config spells as a `mark` object.
export const WIGGLE_RENDERINGS = [
  ['xyplot', 'Bar plot'],
  ['density', 'Density'],
  ['line', 'Line (step)'],
  ['linecenter', 'Line (interpolated)'],
  ['scatter', 'Scatter'],
] as const

export type WiggleRendering = (typeof WIGGLE_RENDERINGS)[number][0]

/** What a quantitative plot draws each score as, the mark display's words. */
export const WIGGLE_MARK_NAMES = ['bar', 'point', 'line', 'span'] as const

/** A point's diameter and a line's width in px while `size` is unset. */
export const DEFAULT_POINT_SIZE_PX = 2
export const DEFAULT_LINE_WIDTH_PX = 1
export type WiggleMark = (typeof WIGGLE_MARK_NAMES)[number]

/** How a line joins its scores: held across each bin, or centre to centre. */
export const LINE_INTERPOLATIONS = ['step', 'linear'] as const
export type LineInterpolation = (typeof LINE_INTERPOLATIONS)[number]

/** The rendering a mark's `type` and a line's `interpolate` draw with. */
export function renderingOf(
  mark: string,
  interpolate: string,
): WiggleRendering {
  switch (mark) {
    case 'point': {
      return 'scatter'
    }
    case 'span': {
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

/** A wiggle display's `mark` object. */
export interface WiggleMarkObject {
  type: WiggleMark
  interpolate?: LineInterpolation
}

/** The `mark` a rendering is written as. */
export function markOf(rendering: string): WiggleMarkObject | undefined {
  switch (rendering) {
    case 'xyplot': {
      return { type: 'bar' }
    }
    case 'scatter': {
      return { type: 'point' }
    }
    case 'density': {
      return { type: 'span' }
    }
    case 'line': {
      return { type: 'line', interpolate: 'step' }
    }
    case 'linecenter': {
      return { type: 'line', interpolate: 'linear' }
    }
    default: {
      return undefined
    }
  }
}
