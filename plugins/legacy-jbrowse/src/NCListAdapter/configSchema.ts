import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const NCListAdapter = ConfigurationSchema(
  'NCListAdapter',
  {
    /**
     * !slot
     */
    rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    },
    /**
     * !slot
     */
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    },
  },
  { explicitlyTyped: true },
)
export default NCListAdapter
