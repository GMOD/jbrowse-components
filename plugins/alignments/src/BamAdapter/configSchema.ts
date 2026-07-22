import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BamAdapter
 * #trackType AlignmentsTrack
 * #fileFormat alignments | BAM
 * used to configure BAM adapter
 *
 * Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
 * automatically supplies it from the enclosing assembly's sequence track.
 *
 * #example
 * The `uri` shorthand auto-resolves the `.bai` index. For a `.csi` index or a
 * differently-named index, set `index` explicitly with the full slot form:
 * ```js
 * {
 *   type: 'BamAdapter',
 *   uri: 'https://example.com/sample.bam',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bamLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        index: {
          location: {
            uri: `${snap.uri}.bai`,
            baseUri: snap.baseUri,
          },
        },
      }
    : snap
}

const configSchema = ConfigurationSchema(
  'BamAdapter',
  {
    /**
     * #slot
     */
    bamLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bam',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('BamIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
      advanced: true,
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.bam.bai:
     * ```json
     * {
     *   "type": "BamAdapter",
     *   "uri": "yourfile.bam"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type BamAdapterConfig = Instance<typeof configSchema>
export default configSchema
