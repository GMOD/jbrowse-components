import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

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

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bedGraphGzLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        index: {
          indexType: snap.csi ? 'CSI' : 'TBI',
          location: {
            uri: `${snap.uri}.${snap.csi ? 'csi' : 'tbi'}`,
            baseUri: snap.baseUri,
          },
        },
      }
    : snap
}

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
    index: ConfigurationSchema('BedGraphTabixIndex', {
      /**
       * #slot index.indexType
       * `TBI` is the usual `tabix` output. `CSI` is required for a reference
       * longer than 512 Mb, which TBI cannot address.
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       * location of the tabix index. Only needed when it is not named
       * `<file>.tbi` (or `.csi`), which is what the `uri` shorthand assumes.
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bedgraph.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
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
