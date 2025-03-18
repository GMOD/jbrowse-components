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
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.2bit',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/default.chrom.sizes',
        locationType: 'UriLocation',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
    },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            twoBitLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default TwoBitAdapter
