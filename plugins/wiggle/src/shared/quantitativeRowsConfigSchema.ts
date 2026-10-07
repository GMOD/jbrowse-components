import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config QuantitativeRows
 * #category display
 * A quantitative display's `rows`: `source` is the one field a quantitative row
 * can be, since a wiggle carries a score per base and a subtrack name and
 * nothing else to put on rows. The arrangement members are the shared `Rows`
 * object's.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: 'source' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rows: { field: 'source', domain: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
 * }
 * ```
 */
export const quantitativeRowsConfigSchema = ConfigurationSchema(
  'QuantitativeRows',
  {
    /**
     * #slot field
     * `source` for one row per subtrack, or empty for one plot every source
     * shares. Writing `rows: "source"` lands here.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('QuantitativeRowsField', ['', 'source']),
      defaultValue: '',
      description:
        'source for one row per subtrack, or empty for one plot every source shares',
    },
  },
  { baseConfiguration: rowsConfigSchema },
)
