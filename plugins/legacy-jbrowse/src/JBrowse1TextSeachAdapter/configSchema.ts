import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config JBrowse1TextSearchAdapternot
 * note: metadata about tracks and assemblies covered by text search adapter
 */
export default ConfigurationSchema(
  'JBrowse1TextSearchAdapter',
  {
    /**
     * !slot
     */
    namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names', locationType: 'UriLocation' },
      description: 'the location of the JBrowse1 names index data directory',
    },
    /**
     * !slot
     */
    tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    },
    /**
     * !slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'textSearchAdapterId' },
)
