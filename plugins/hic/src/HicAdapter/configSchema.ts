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
