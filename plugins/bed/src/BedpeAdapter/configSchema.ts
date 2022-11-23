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
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bedpe.gz',
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
export default BedpeAdapter
