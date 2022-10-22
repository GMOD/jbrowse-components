import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BigBedAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BigBedAdapter = ConfigurationSchema(
  'BigBedAdapter',
  {
    /**
     * #slot
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)

export default BigBedAdapter
