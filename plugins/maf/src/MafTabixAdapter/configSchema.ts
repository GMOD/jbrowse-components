import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MafTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'MafTabixAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description: 'string[] or {id:string,label:string,color?:string}[]',
      defaultValue: [],
    },
    /**
     * #slot
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz.tbi',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    refAssemblyName: {
      type: 'string',
      defaultValue: '',
    },
    index: ConfigurationSchema('Index', {
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bed.gz.tbi',
        },
      },
      /**
       * #slot index.indexType
       */
      indexType: {
        type: 'string',
        defaultValue: 'TBI',
      },
    }),
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            ...(snap.nhUri
              ? {
                  nhLocation: {
                    uri: snap.nhUri,
                    baseUri: snap.baseUri,
                  },
                }
              : {}),
            bedGzLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              location: {
                uri: `${snap.uri}.tbi`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default configSchema
