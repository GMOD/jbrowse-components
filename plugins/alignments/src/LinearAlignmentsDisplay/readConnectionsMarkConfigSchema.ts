import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { READ_CONNECTIONS_MARKS } from './constants.ts'

/**
 * #config ReadConnectionsMark
 * #category display
 * The read connections' `mark`, Vega-Lite's mark object. A `link` joins the
 * two ends of each pair or split read with a dome that rises with the span
 * between them; a `rule` is the read cloud, a flat line between the ends at
 * the pair's insert size on a log axis, which leaves the pairs of modal
 * insert size out unless `ordinaryPairs.show` keeps them. A bare name is the
 * `type`, so `mark: "rule"` and `mark: { type: "rule" }` are one config.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, mark: 'rule' },
 * }
 * ```
 */
export const readConnectionsMarkConfigSchema = ConfigurationSchema(
  'ReadConnectionsMark',
  {
    /**
     * #slot
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('ReadConnectionsMarkType', [
        ...READ_CONNECTIONS_MARKS,
      ]),
      defaultValue: 'link',
      description:
        "link, a dome between each pair's ends, or rule, the read cloud's flat line at each pair's insert size",
    },
  },
  { shorthand: 'type', writes: 'members', plot: true, closed: true },
)
