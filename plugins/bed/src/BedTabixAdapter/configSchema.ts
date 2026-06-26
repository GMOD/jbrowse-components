import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bedGzLocation: { uri: snap.uri, baseUri: snap.baseUri },
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

/**
 * #config BedTabixAdapter
 * #trackType FeatureTrack
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
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('TabixIndex', {
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
          uri: '/path/to/my.bed.gz.tbi',
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
