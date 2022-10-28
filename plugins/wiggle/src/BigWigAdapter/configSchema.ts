import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BigWigAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BigWigAdapter = ConfigurationSchema(
  'BigWigAdapter',
  {
    /**
     * #slot
     */
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot
     */
    source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
    },
  },
  { explicitlyTyped: true },
)

export default BigWigAdapter
