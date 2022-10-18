import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const ChromSizesAdapter = ConfigurationSchema(
  'ChromSizesAdapter',
  {
    /**
     * !slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/species.chrom.sizes',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default ChromSizesAdapter
