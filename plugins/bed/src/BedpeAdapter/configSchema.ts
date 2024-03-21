import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BedpeAdapter
 * intended for SVs in a single assembly
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BedpeAdapter = ConfigurationSchema(
  'BedpeAdapter',
  {
    /**
     * #slot
     * can be plaintext or gzipped, not indexed so loaded into memory on startup
     */
    bedpeLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/my.bedpe.gz',
      },
      type: 'fileLocation',
    },
    /**
     * #slot
     */
    columnNames: {
      defaultValue: [],
      description: 'List of column names',
      type: 'stringArray',
    },
  },
  { explicitlyTyped: true },
)
export default BedpeAdapter
