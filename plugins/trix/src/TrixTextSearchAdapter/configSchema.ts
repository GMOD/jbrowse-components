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
    assemblyNames: {
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    ixFilePath: {
      defaultValue: { locationType: 'UriLocation', uri: 'out.ix' },
      description: 'the location of the trix ix file',
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    ixxFilePath: {
      defaultValue: { locationType: 'UriLocation', uri: 'out.ixx' },
      description: 'the location of the trix ixx file',
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    metaFilePath: {
      defaultValue: { locationType: 'UriLocation', uri: 'meta.json' },
      description: 'the location of the metadata json file for the trix index',
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    tracks: {
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
      type: 'stringArray',
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'textSearchAdapterId',

    explicitlyTyped: true,
  },
)

export default TrixTextSearchAdapter
