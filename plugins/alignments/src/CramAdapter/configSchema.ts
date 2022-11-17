import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config CramAdapter
 * used to configure CRAM adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'CramAdapter',
  {
    /**
     * #slot fetchSizeLimit
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
    },

    /**
     * #slot cramLocation
     */
    cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot craiLocation
     */
    craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot sequenceAdapter
     * generally refers to the reference genome assembly's sequence adapter
     * currently needs to be manually added
     */
    sequenceAdapter: {
      type: 'frozen',
      description: 'sequence data adapter',
      defaultValue: null,
    },
  },
  { explicitlyTyped: true },
)
export default configSchema
