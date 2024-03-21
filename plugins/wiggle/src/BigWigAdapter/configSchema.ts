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
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.bw',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    source: {
      defaultValue: '',
      description: 'Used for multiwiggle',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default BigWigAdapter
