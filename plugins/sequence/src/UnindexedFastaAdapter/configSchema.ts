import { ConfigurationSchema } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config UnindexedFastaAdapter
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        fastaLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const UnindexedFastaAdapter = ConfigurationSchema(
  'UnindexedFastaAdapter',
  {
    /**
     * #slot
     */
    rewriteRefNames: {
      type: 'string',
      defaultValue: '',
      contextVariable: ['refName'],
    },
    /**
     * #slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
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
     *   "type": "UnindexedFastaAdapter",
     *   "uri": "yourfile.fa"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type UnindexedFastaAdapterConfig = Instance<typeof UnindexedFastaAdapter>
export default UnindexedFastaAdapter
