import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BedGraphTabixAdapter
 * #trackType QuantitativeTrack
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
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
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
