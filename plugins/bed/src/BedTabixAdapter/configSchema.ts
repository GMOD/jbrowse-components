import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'
import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'bedGzLocation')
}

/**
 * #config BedTabixAdapter
 * #trackType FeatureTrack
 * #fileFormat feature | BED (tabix)
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a
 * `.csi` index instead:
 * ```js
 * {
 *   type: 'BedTabixAdapter',
 *   uri: 'https://example.com/features.bed.gz',
 * }
 * ```
 */

const BedTabixAdapter = ConfigurationSchema(
  'BedTabixAdapter',
  {
    /**
     * #slot
     * location of the bgzip-compressed BED, sorted by position. Must be bgzip
     * rather than plain gzip, which tabix cannot index.
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),

    /**
     * #slot
     */
    columnNames: {
      type: 'stringArray',
      description:
        "List of column names. A column named like a standard BED column is parsed as that column's type (chromStart numeric, blockSizes a numeric list); any other column is text",
      defaultValue: [],
    },

    /**
     * #slot
     */
    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    },

    /**
     * #slot
     */
    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    },

    /**
     * #slot
     */
    disableGeneHeuristic: {
      type: 'boolean',
      description:
        'Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications)',
      defaultValue: false,
    },
    ...densityAdapterConfigSchemaFields,
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.bed.gz.tbi:
     * ```json
     * {
     *   "type": "BedTabixAdapter",
     *   "uri": "yourfile.bed.gz"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type BedTabixAdapterConfig = Instance<typeof BedTabixAdapter>

export default BedTabixAdapter
