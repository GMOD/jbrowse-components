import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pairwiseAssemblyFields } from '../pairwiseAssemblyFields.ts'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        chainLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config ChainAdapter
 * #category adapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Chain (UCSC liftOver / lastz)
 * used to load UCSC chain alignment files (query and target assembly required)
 *
 * #example
 * ```js
 * {
 *   type: 'ChainAdapter',
 *   uri: 'https://example.com/aln.chain',
 *   queryAssembly: 'hg19',
 *   targetAssembly: 'hg38',
 * }
 * ```
 */
const ChainAdapter = ConfigurationSchema(
  'ChainAdapter',
  {
    ...pairwiseAssemblyFields,
    /**
     * #slot
     * location of the UCSC chain file, as used by `liftOver` and produced by
     * `axtChain`. May be gzipped; the whole file is read into memory.
     */
    chainLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.chain', locationType: 'UriLocation' },
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
     *   "type": "ChainAdapter",
     *   "uri": "yourfile.chain.gz",
     *   "queryAssembly": "hg19",
     *   "targetAssembly": "hg38"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default ChainAdapter
