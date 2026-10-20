import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { WIGGLE_MARK_NAMES } from '../renderingTypes.ts'

/**
 * #config WiggleMark
 * #category display
 * A wiggle display's `mark`, Vega-Lite's mark object: the `type` each score
 * draws as. A bare name is the `type`, so `mark: "span"` and
 * `mark: { type: "span" }` are one config.
 *
 * #example
 * ```json
 * { "type": "LinearWiggleDisplay", "mark": { "type": "point" } }
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
  },
  { shorthand: 'type', writes: 'members', plot: true, closed: true },
)
