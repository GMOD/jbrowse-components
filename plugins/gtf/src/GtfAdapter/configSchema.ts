import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GtfAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GtfAdapter = ConfigurationSchema(
  'GtfAdapter',
  {
    /**
     * #slot
     */
    gtfLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.gtf' },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default GtfAdapter
