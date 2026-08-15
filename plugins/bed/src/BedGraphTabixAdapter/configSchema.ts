import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexFields,
} from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'bedGraphGzLocation')
}

/**
 * #config BedGraphTabixAdapter
 * #trackType QuantitativeTrack
 * #fileFormat quantitative | BedGraph (tabix)
 * used to load bgzip-compressed, tabix-indexed bedGraph signal files
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index:
 * ```js
 * {
 *   type: 'BedGraphTabixAdapter',
 *   uri: 'https://example.com/signal.bedGraph.gz',
 * }
 * ```
 */
const BedGraphTabixAdapter = ConfigurationSchema(
  'BedGraphTabixAdapter',
  {
    /**
     * #slot
     * location of the bgzip-compressed bedGraph (`chrom start end value`,
     * sorted by position). Must be bgzip rather than plain gzip, which tabix
     * cannot index.
     */
    bedGraphGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedgraph',
        locationType: 'UriLocation',
      },
    },
    index: ConfigurationSchema('TabixIndex', { ...tabixIndexFields }),
    /**
     * #slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.bg.gz.tbi:
     * ```json
     * {
     *   "type": "BedGraphTabixAdapter",
     *   "uri": "yourfile.bg.gz"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type BedGraphTabixAdapterConfig = Instance<typeof BedGraphTabixAdapter>

export default BedGraphTabixAdapter
