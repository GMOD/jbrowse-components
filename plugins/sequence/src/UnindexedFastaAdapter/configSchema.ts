import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

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

/**
 * #config UnindexedFastaAdapter
 * #trackType ReferenceSequenceTrack
 * #fileFormat sequence | Plain FASTA (.fa, no index) | Read entirely into memory; prefer an indexed form for large genomes
 * loads a plain (non-bgzipped) FASTA without a separate index. Reads the whole
 * sequence into memory, so prefer the IndexedFastaAdapter for large genomes.
 *
 * #example
 * ```js
 * {
 *   type: 'UnindexedFastaAdapter',
 *   uri: 'https://example.com/genome.fa',
 * }
 * ```
 */
const UnindexedFastaAdapter = ConfigurationSchema(
  'UnindexedFastaAdapter',
  {
    /**
     * #slot
     * jexl expression rewriting each sequence name as the FASTA is parsed, e.g.
     * `jexl:split(refName, ' ')[0]` to keep only the first word of a
     * description line. Left empty, names are used as written; an expression
     * returning nothing falls back to the original name.
     */
    rewriteRefNames: {
      type: 'string',
      defaultValue: '',
      contextVariable: ['refName'],
    },
    /**
     * #slot
     * location of the plain FASTA. With no index there are no byte offsets to
     * seek to, so the whole file is downloaded and parsed on first use and held
     * in memory.
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
