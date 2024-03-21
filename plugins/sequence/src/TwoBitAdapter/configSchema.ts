import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config TwoBitAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const TwoBitAdapter = ConfigurationSchema(
  'TwoBitAdapter',
  {
    /**
     * #slot
     */
    chromSizesLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/default.chrom.sizes',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    twoBitLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.2bit' },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default TwoBitAdapter
