/** What a quantitative plot draws each score as, the mark display's words. */
export const WIGGLE_MARK_NAMES = ['bar', 'point', 'line', 'rect'] as const
export type WiggleMark = (typeof WIGGLE_MARK_NAMES)[number]

/** How a line joins its scores: held across each bin, or centre to centre. */
export const LINE_INTERPOLATIONS = ['step', 'linear'] as const
export type LineInterpolation = (typeof LINE_INTERPOLATIONS)[number]

/** A wiggle display's `mark` object. */
export interface WiggleMarkObject {
  type: WiggleMark
  interpolate?: LineInterpolation
}

// Import-free, so the docs' spec-recipe field map can read the menu labels
// without loading the wiggle-core barrel. [rendering, mark, menu label]: one
// Plot type radio per rendering the shaders draw, writing its `mark`.
export const WIGGLE_PLOTS = [
  ['xyplot', { type: 'bar' }, 'Bar plot'],
  ['density', { type: 'rect' }, 'Density'],
  ['line', { type: 'line', interpolate: 'step' }, 'Line (step)'],
  [
    'linecenter',
    { type: 'line', interpolate: 'linear' },
    'Line (interpolated)',
  ],
  ['scatter', { type: 'point' }, 'Scatter'],
] as const satisfies readonly (readonly [string, WiggleMarkObject, string])[]

export type WiggleRendering = (typeof WIGGLE_PLOTS)[number][0]

/** `encoding.size` and `encoding.strokeWidth` in px while unset. */
export const DEFAULT_POINT_SIZE_PX = 2
export const DEFAULT_LINE_WIDTH_PX = 1

/** The rendering a mark's `type` and a line's `interpolate` draw with. */
export function renderingOf(
  mark: string,
  interpolate: string,
): WiggleRendering {
  switch (mark) {
    case 'point': {
      return 'scatter'
    }
    case 'rect': {
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

/** The `mark` a v4 rendering name is written as. */
export function markOf(rendering: string): WiggleMarkObject | undefined {
  const mark = WIGGLE_PLOTS.find(([r]) => r === rendering)?.[1]
  return mark ? { ...mark } : undefined
}
