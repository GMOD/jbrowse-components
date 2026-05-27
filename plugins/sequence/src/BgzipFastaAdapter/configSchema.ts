import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config BgzipFastaAdapter
 */
export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        fastaLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        faiLocation: {
          uri: `${snap.uri}.fai`,
          baseUri: snap.baseUri,
        },
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
