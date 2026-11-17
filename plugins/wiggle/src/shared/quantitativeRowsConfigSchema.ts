import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'

/**
 * #config QuantitativeRows
 * #category display
 * A quantitative display's `rows`: `source` puts each subtrack on a row of
 * its own, and any other field one row per value of that subtrack attribute
 * (a subadapter's `group`, a samples table column), the subtracks sharing a
 * value overlaid in their row. The arrangement members are the shared `Rows`
 * object's.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: 'source' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rows: { field: 'source', sort: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
 * }
 * ```
 * ```js
 * { type: 'LinearWiggleDisplay', rows: { field: 'group' } }
 * ```
 */
export const quantitativeRowsConfigSchema = ConfigurationSchema(
  'QuantitativeRows',
  {
    /**
     * #slot field
     * `source` for one row per subtrack, a subtrack attribute such as
     * `group` for one row per value with its subtracks overlaid, or empty for
     * one plot every source shares. Writing `rows: "source"` lands here.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description:
        'source for one row per subtrack, a subtrack attribute such as group for one row per value with its subtracks overlaid, or empty for one plot every source shares',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowsConfigSchema,
  },
)
