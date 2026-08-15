import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pairwiseAssemblyFields } from '../pairwiseAssemblyFields.ts'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        deltaLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config DeltaAdapter
 * #category adapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Delta (MUMmer / nucmer)
 * used to load MUMmer `.delta` alignment files (query and target assembly
 * required)
 *
 * #example
 * ```js
 * {
 *   type: 'DeltaAdapter',
 *   uri: 'https://example.com/aln.delta',
 *   queryAssembly: 'hg19',
 *   targetAssembly: 'hg38',
 * }
 * ```
 */
const DeltaAdapter = ConfigurationSchema(
  'DeltaAdapter',
  {
    ...pairwiseAssemblyFields,
    /**
     * #slot
     * location of the MUMmer `.delta` file written by `nucmer`/`promer` (also
     * accepts the `delta-filter` output). May be gzipped; the whole file is
     * read into memory.
     */
    deltaLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.delta',
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
     *   "type": "DeltaAdapter",
     *   "uri": "yourfile.delta.gz",
     *   "queryAssembly": "hg19",
     *   "targetAssembly": "hg38"
     * }
     * ```
     */

    preProcessSnapshot: normalizeSnapshot,
  },
)

export default DeltaAdapter
