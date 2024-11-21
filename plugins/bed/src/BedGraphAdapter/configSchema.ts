import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BedGraphAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BedGraphAdapter = ConfigurationSchema(
  'BedGraphAdapter',
  {
    /**
     * #slot
     */
    bedGraphLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedgraph',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)
export default BedGraphAdapter
