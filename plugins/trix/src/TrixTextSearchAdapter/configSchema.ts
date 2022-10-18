import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const TrixTextSearchAdapter = ConfigurationSchema(
  'TrixTextSearchAdapter',
  {
    /**
     * !config
     */
    ixFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ix', locationType: 'UriLocation' },
      description: 'the location of the trix ix file',
    },
    /**
     * !config
     */
    ixxFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'out.ixx', locationType: 'UriLocation' },
      description: 'the location of the trix ixx file',
    },
    /**
     * !config
     */
    metaFilePath: {
      type: 'fileLocation',
      defaultValue: { uri: 'meta.json', locationType: 'UriLocation' },
      description: 'the location of the metadata json file for the trix index',
    },
    /**
     * !config
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    },
    /**
     * !config
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'textSearchAdapterId',
  },
)

export default TrixTextSearchAdapter
