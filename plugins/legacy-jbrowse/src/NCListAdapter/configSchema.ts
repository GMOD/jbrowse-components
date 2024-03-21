import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config NCListAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const NCListAdapter = ConfigurationSchema(
  'NCListAdapter',
  {
    /**
     * #slot
     */
    refNames: {
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    rootUrlTemplate: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my/{refseq}/trackData.json',
      },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)
export default NCListAdapter
