import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { deriveFastaLocations } from '../chromSizesUtils.ts'
/**
 * #config BgzipFastaAdapter
 * #trackType ReferenceSequenceTrack
 *
 * #example
 * The `uri` shorthand auto-resolves the `.fai` and `.gzi` indexes:
 * ```js
 * {
 *   type: 'BgzipFastaAdapter',
 *   uri: 'https://example.com/genome.fa.gz',
 * }
 * ```
 */
export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        ...deriveFastaLocations(snap),
        gziLocation: {
          uri: `${snap.uri}.gzi`,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const BgzipFastaAdapter = ConfigurationSchema(
  'BgzipFastaAdapter',
  {
    /**
     * #slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' },
    },
    /**
     * #slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.fai',
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
    /**
     * #slot
     */
    gziLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa.gz.gzi',
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
     * preprocessor to allow minimal config, assumes yourfile.fa.fai and yourfile.fa.gzi:
     * ```json
     * {
     *   "type": "BgzipFastaAdapter",
     *   "uri": "yourfile.fa"
     * }
     * ```
     */

    preProcessSnapshot: normalizeSnapshot,
  },
)
export default BgzipFastaAdapter
