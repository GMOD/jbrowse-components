import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const BigBedAdapter = ConfigurationSchema(
  'BigBedAdapter',
  {
    /**
     * !slot
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)

export default BigBedAdapter
