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
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gtf', locationType: 'UriLocation' },
    },
    /**
     * #slot
     */
    aggregateField: {
      type: 'string',
      defaultValue: 'gene_name',
    },
  },
  { explicitlyTyped: true },
)

export default GtfAdapter
