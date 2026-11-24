import {
  ConfigurationSchema,
  expandTabixShorthand,
  tabixIndexSchema,
} from '@jbrowse/core/configuration'
import { samplesTsvAdapterConfigSchemaFields } from '@jbrowse/core/util/samplesTsv'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return expandTabixShorthand(snap, 'bedGraphGzLocation')
}

/**
 * #config BedGraphTabixAdapter
 * #trackType QuantitativeTrack
 * #fileFormat quantitative | BedGraph (tabix)
 * Reads bgzip-compressed, tabix-indexed bedGraph signal files.
 *
 * Several signals in one file are a `MultiQuantitativeTrack`'s subtracks:
 * one value column each, named by the header, or a `source` column naming each
 * row's, which is the form Save track data writes.
 *
 * #example
 * The `uri` shorthand auto-resolves the `.tbi` index:
 * ```js
 * {
 *   type: 'BedGraphTabixAdapter',
 *   uri: 'https://example.com/signal.bedGraph.gz',
 * }
 * ```
 *
 * #example
 * Per-column metadata from a table whose first column names each value column
 * as the header does; the track shows only the columns the table lists:
 * ```js
 * {
 *   type: 'BedGraphTabixAdapter',
 *   uri: 'https://example.com/cohort.bedgraph.gz',
 *   samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
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
    /**
     * #slot
     * The tabix index location and its kind. The `uri` shorthand derives
     * both, so a config using it states neither.
     */
    index: tabixIndexSchema(),
    /**
     * #slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    },
    ...samplesTsvAdapterConfigSchemaFields,
  },
  {
    explicitlyTyped: true,
    closed: true,

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
