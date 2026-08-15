import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { deriveFastaLocations } from '../chromSizesUtils.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri ? { ...snap, ...deriveFastaLocations(snap) } : snap
}

/**
 * #config IndexedFastaAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat sequence | Indexed FASTA (.fa + .fai)
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
const IndexedFastaAdapter = ConfigurationSchema(
  'IndexedFastaAdapter',
  {
    /**
     * #slot
     * location of the FASTA file. Only the visible bases are fetched, as byte
     * ranges resolved through the `.fai`, so the file itself is never
     * downloaded whole.
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    },
    /**
     * #slot
     * location of the `samtools faidx` index (`.fai`). It supplies the
     * reference names and lengths as well as the byte offsets, so the assembly
     * cannot load without it.
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
