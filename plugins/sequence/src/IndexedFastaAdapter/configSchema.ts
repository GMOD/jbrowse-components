import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { deriveFastaLocations } from '../chromSizesUtils.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config IndexedFastaAdapter
 *
 * #example
 * The `uri` shorthand auto-resolves the `.fai` index:
 * ```js
 * {
 *   type: 'IndexedFastaAdapter',
 *   uri: 'https://example.com/genome.fa',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri ? { ...snap, ...deriveFastaLocations(snap) } : snap
}

const IndexedFastaAdapter = ConfigurationSchema(
  'IndexedFastaAdapter',
  {
    /**
     * #slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    },
    /**
     * #slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
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
     * preprocessor to allow minimal config, assumes yourfile.fa.fai:
     * ```json
     * {
     *   "type": "IndexedFastaAdapter",
     *   "uri": "yourfile.fa"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type IndexedFastaAdapterConfig = Instance<typeof IndexedFastaAdapter>
export default IndexedFastaAdapter
