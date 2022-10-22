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
    rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
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
