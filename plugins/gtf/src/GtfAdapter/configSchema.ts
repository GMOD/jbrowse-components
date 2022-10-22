import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GtfAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GtfAdapter = ConfigurationSchema(
  'GtfAdapter',
  {
    /**
     * #slot
     */
    gtfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gtf', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)

export default GtfAdapter
