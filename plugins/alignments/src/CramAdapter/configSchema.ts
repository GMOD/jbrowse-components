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
     * #slot craiLocation
     */
    craiLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.cram.crai',
      },
      type: 'fileLocation',
    },

    /**
     * #slot cramLocation
     */
    cramLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.cram',
      },
      type: 'fileLocation',
    },

    /**
     * #slot fetchSizeLimit
     */
    fetchSizeLimit: {
      defaultValue: 3_000_000,
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      type: 'number',
    },

    /**
     * #slot sequenceAdapter
     * generally refers to the reference genome assembly's sequence adapter
     * currently needs to be manually added
     */
    sequenceAdapter: {
      defaultValue: null,
      description: 'sequence data adapter',
      type: 'frozen',
    },
  },
  { explicitlyTyped: true },
)
export default configSchema
