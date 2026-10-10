import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  SORT_TYPES,
  alignmentsSortConfigSchema,
} from '@jbrowse/plugin-alignments'

/**
 * #config LGVSyntenySort
 * #category display
 * The LGVSyntenyDisplay's `sort` setting: the
 * [AlignmentsSort](../alignmentssort) object with `type` defaulting to
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
     * #slot type
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('LGVSyntenySortType', [...SORT_TYPES]),
      defaultValue: 'length',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: alignmentsSortConfigSchema,
    shorthand: 'type',
    closed: true,
  },
)
