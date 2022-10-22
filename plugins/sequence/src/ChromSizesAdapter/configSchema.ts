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
