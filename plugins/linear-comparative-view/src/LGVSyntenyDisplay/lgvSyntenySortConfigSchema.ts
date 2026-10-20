import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { alignmentsSortConfigSchema } from '@jbrowse/plugin-alignments'

/**
 * #config LGVSyntenySort
 * #category display
 * The LGVSyntenyDisplay's `sort` setting: the
 * [AlignmentsSort](../alignmentssort) object with `field` defaulting to
 * `length`, so big syntenic blocks cluster at the top instead of interleaving
 * with small ones.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', sort: 'position' }
 * ```
 */
export const lgvSyntenySortConfigSchema = ConfigurationSchema(
  'LGVSyntenySort',
  {
    /**
     * #slot field
     */
    field: {
      type: 'string',
      defaultValue: 'length',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: alignmentsSortConfigSchema,
    shorthand: 'field',
    writes: 'whole',
    closed: true,
  },
)
