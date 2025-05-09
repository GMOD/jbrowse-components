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
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "BedGraphAdapter",
     *   "uri": "yourfile.bed"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            bedGraphLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)
export default BedGraphAdapter
