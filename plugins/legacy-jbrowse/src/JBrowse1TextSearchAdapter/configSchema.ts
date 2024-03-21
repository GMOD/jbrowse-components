import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config JBrowse1TextSearchAdapter
 * note: metadata about tracks and assemblies covered by text search adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default ConfigurationSchema(
  'JBrowse1TextSearchAdapter',
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
    namesIndexLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/volvox/names' },
      description: 'the location of the JBrowse1 names index data directory',
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
