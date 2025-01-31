import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HapIbdAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const HapIbdAdapter = ConfigurationSchema(
  'HapIbdAdapter',
  {
    /**
     * #slot
     */
    hapIbdLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hap.ibd.gz',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default HapIbdAdapter
