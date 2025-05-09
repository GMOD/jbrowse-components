import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BedAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BedAdapter = ConfigurationSchema(
  'BedAdapter',
  {
    /**
     * #slot
     */
    bedLocation: {
      type: 'fileLocation',
      description: 'path to bed file, also allows gzipped bed',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
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
    /**
     * #slot
     */
    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    },
    /**
     * #slot
     */
    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    },
    /**
     * #slot
     */
    colRef: {
      type: 'number',
      description: 'The column to use as a "refName" attribute',
      defaultValue: 0,
    },
    /**
     * #slot
     */
    colStart: {
      type: 'number',
      description: 'The column to use as a "start" attribute',
      defaultValue: 1,
    },
    /**
     * #slot
     */
    colEnd: {
      type: 'number',
      description: 'The column to use as a "end" attribute',
      defaultValue: 2,
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
     *   "type": "BedAdapter",
     *   "uri": "yourfile.bed"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            bedLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)
export default BedAdapter
