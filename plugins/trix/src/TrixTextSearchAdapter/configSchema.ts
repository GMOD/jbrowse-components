import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config TrixTextSearchAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const TrixTextSearchAdapter = ConfigurationSchema(
  'TrixTextSearchAdapter',
  {
    /**
     * #slot
     */
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'out.ix',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'out.ixx',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    metaFilePath: {
      type: 'fileLocation',
      defaultValue: {
        uri: 'meta.json',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  {
    explicitlyTyped: true,
    /**
     * #identifier
     */
    explicitIdentifier: 'textSearchAdapterId',

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes file.ixx also exists:
     * ```json
     * {
     *   "type": "TrixTextSearchAdapter",
     *   "uri": "file.ix",
     *   "assemblyNames": ["hg19"],
     *   "textSearchAdapterId": "hg19SearchIndex"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            ixFilePath: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            ixxFilePath: {
              uri: `${snap.uri}x`,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default TrixTextSearchAdapter
