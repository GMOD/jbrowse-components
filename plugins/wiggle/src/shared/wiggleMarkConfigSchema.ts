import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { LINE_INTERPOLATIONS, WIGGLE_MARK_NAMES } from '../renderingTypes.ts'

export const EXTENTS = ['min-max', 'none'] as const
export type Extent = (typeof EXTENTS)[number]

/**
 * #config WiggleMark
 * #category display
 * A wiggle display's `mark`, Vega-Lite's mark object: the `type` each score
 * draws as, a line's `interpolate`, and the `extent` drawn around each bin. A
 * bare name is the `type`, so `mark: "rect"` and `mark: { type: "rect" }` are
 * one config.
 *
 * #example
 * ```json
 * { "type": "LinearWiggleDisplay", "mark": { "type": "point" } }
 * ```
 *
 * #example
 * ```json
 * {
 *   "type": "LinearWiggleDisplay",
 *   "mark": { "type": "line", "interpolate": "linear", "extent": "none" }
 * }
 * ```
 */
export const wiggleMarkConfigSchema = ConfigurationSchema(
  'WiggleMark',
  {
    /**
     * #slot
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('WiggleMarkType', [...WIGGLE_MARK_NAMES]),
      defaultValue: 'bar',
      description: 'bar, point, line or rect',
    },
    /**
     * #slot
     * The path a `line` takes between scores: `step` holds each across its
     * bin, as the data says; `linear` runs from one bin's centre to the next,
     * smoother where the bins are few. Read by a line alone.
     */
    interpolate: {
      type: 'stringEnum',
      model: types.enumeration('LineInterpolation', [...LINE_INTERPOLATIONS]),
      defaultValue: 'step',
      description: 'step or linear, for a line',
    },
    /**
     * #slot
     * The span drawn around each bin's plotted value, as Vega-Lite's
     * `errorband` names it: `min-max` draws the bin's stored min and max as a
     * lighter band, while `encoding.y` names a stored summary. A `rect` draws
     * none.
     */
    extent: {
      type: 'stringEnum',
      model: types.enumeration('Extent', [...EXTENTS]),
      defaultValue: 'min-max',
      description:
        "the span drawn around each bin's plotted value: 'min-max' draws the bin's stored min and max with it, as a lighter band, while `encoding.y` names a stored summary",
    },
  },
  { shorthand: 'type', writes: 'members', plot: true, closed: true },
)

/** The `mark` of a track type whose wiggle display draws no band by default. */
export function wiggleMarkWithoutExtent(description?: string) {
  return ConfigurationSchema(
    'WiggleMark',
    {
      extent: {
        type: 'stringEnum',
        defaultValue: 'none',
        ...(description ? { description } : {}),
      },
    },
    { baseConfiguration: wiggleMarkConfigSchema },
  )
}
