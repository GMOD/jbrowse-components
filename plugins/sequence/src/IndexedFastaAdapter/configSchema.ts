import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config IndexedFastaAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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
    preProcessSnapshot: snap => {
      // populate from just snap.uri
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
          }
        : snap
    },
  },
)
export default IndexedFastaAdapter
