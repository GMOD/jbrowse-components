import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HicAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const HicAdapter = ConfigurationSchema(
  'HicAdapter',
  {
    /**
     * #slot
     */
    hicLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.hic',
      },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default HicAdapter
