import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const GtfAdapter = ConfigurationSchema(
  'GtfAdapter',
  {
    /**
     * !slot
     */
    gtfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gtf', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)

export default GtfAdapter
