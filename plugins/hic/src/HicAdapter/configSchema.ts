import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const HicAdapter = ConfigurationSchema(
  'HicAdapter',
  {
    /**
     * !slot
     */
    hicLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hic',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default HicAdapter
