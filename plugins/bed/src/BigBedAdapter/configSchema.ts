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
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bb' },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default BigBedAdapter
