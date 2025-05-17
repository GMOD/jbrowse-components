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
     */
    bedpeLocation: {
      type: 'fileLocation',
      description:
        'can be plaintext or gzipped, not indexed so loaded into memory on startup',
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
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "BedpeAdapter",
     *   "uri": "yourfile.bedpe.gz"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            bedpeLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)
export default BedpeAdapter
