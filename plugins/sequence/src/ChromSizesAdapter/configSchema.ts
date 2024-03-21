import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ChromSizesAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const ChromSizesAdapter = ConfigurationSchema(
  'ChromSizesAdapter',
  {
    /**
     * #slot
     */
    chromSizesLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/species.chrom.sizes',
      },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default ChromSizesAdapter
