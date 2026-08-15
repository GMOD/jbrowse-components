import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bedGraphLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config BedGraphAdapter
 * #trackType QuantitativeTrack
 * #fileFormat quantitative | BedGraph (plain) | Loaded entirely into memory; for small files
 * used to load plain-text bedGraph signal files. Loads the whole file into
 * memory, so prefer the BedGraphTabixAdapter for large files.
 *
 * #example
 * ```js
 * {
 *   type: 'BedGraphAdapter',
 *   uri: 'https://example.com/signal.bedGraph',
 * }
 * ```
 */
const BedGraphAdapter = ConfigurationSchema(
  'BedGraphAdapter',
  {
    /**
     * #slot
     * location of the plain-text bedGraph (`chrom start end value`, one line
     * per interval). May be gzipped.
     */
    bedGraphLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedgraph',
        locationType: 'UriLocation',
      },
    },
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
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "BedGraphAdapter",
     *   "uri": "yourfile.bed"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type BedGraphAdapterConfig = Instance<typeof BedGraphAdapter>

export default BedGraphAdapter
