import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pairwiseAssemblyFields } from '../pairwiseAssemblyFields.ts'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        outLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config MashMapAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | MashMap
 * used to load MashMap `.out` alignment files (query and target assembly
 * required)
 *
 * #example
 * ```js
 * {
 *   type: 'MashMapAdapter',
 *   uri: 'https://example.com/aln.out',
 *   queryAssembly: 'hg19',
 *   targetAssembly: 'hg38',
 * }
 * ```
 */
const MashMapAdapter = ConfigurationSchema(
  'MashMapAdapter',
  {
    ...pairwiseAssemblyFields,

    /**
     * #slot
     * location of the MashMap `.out` file — PAF-like records with MashMap's
     * approximate identity in place of a CIGAR, so the bands it draws are
     * mapping blocks with no base-level alignment inside them.
     */
    outLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mashmap.out',
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
     *   "type": "MashMapAdapter",
     *   "uri": "file.out",
     *   "queryAssembly":"hg19",
     *   "targetAssembly":"hg38"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default MashMapAdapter
