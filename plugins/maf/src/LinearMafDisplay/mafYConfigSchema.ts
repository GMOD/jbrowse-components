import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { MAF_Y_FIELDS } from './rowRenderings.ts'

/**
 * #config MafY
 * #category display
 * The MAF display's `encoding.y`: the value a row's bar height shows. Its
 * only value scale is the coverage band's `coverage.encoding.y`.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', encoding: { y: 'identity' } }
 * ```
 */
export const mafYConfigSchema = ConfigurationSchema(
  'MafY',
  {
    /**
     * #slot
     * Unset, each row is one band of cells. `identity` draws each row as a
     * bar chart of its identity to the reference, the bars painted by
     * `encoding.color` where it is `identity` and in one color otherwise.
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('MafYField', [...MAF_Y_FIELDS]),
      description:
        "the value a row's bar height shows: identity, or unset for none",
    },
  },
  { closed: true, shorthand: 'field', writes: 'whole' },
)
