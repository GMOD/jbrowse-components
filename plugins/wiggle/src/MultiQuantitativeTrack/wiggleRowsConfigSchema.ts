import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { quantitativeRowsConfigSchema } from '../shared/quantitativeRowsConfigSchema.ts'

/**
 * #config WiggleRows
 * #category display
 * The `rows` of a `LinearWiggleDisplay` on a `MultiQuantitativeTrack`: a
 * [QuantitativeRows](../quantitativerows) whose `field` defaults to `source`,
 * so each subtrack draws its own row.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: { field: '' } }
 * ```
 */
export const wiggleRowsConfigSchema = ConfigurationSchema(
  'WiggleRows',
  {
    /**
     * #slot field
     * `source` for one row per subtrack, or empty for one plot every source
     * shares. Empty stays a value rather than unset, since under this default
     * unset could not say "one plot every source shares".
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('QuantitativeRowsField', ['', 'source']),
      defaultValue: 'source',
      description:
        'source for one row per subtrack, or empty for one plot every source shares',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: quantitativeRowsConfigSchema,
  },
)
