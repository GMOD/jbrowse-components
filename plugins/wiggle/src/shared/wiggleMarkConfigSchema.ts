import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { LINE_INTERPOLATIONS, WIGGLE_MARK_NAMES } from '../renderingTypes.ts'

/**
 * #config WiggleMark
 * #category display
 * A wiggle display's `mark`, Vega-Lite's mark object: the `type` each score
 * draws as, and a line's `interpolate`. A bare name is the `type`, so
 * `mark: "rect"` and `mark: { type: "rect" }` are one config.
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
 *   "mark": { "type": "line", "interpolate": "linear" }
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
      description: 'bar, point, line or span',
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
  },
  { shorthand: 'type', writes: 'members', plot: true, closed: true },
)
