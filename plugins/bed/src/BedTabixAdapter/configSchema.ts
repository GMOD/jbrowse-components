import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config BedTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BedTabixAdapter = ConfigurationSchema(
  'BedTabixAdapter',
  {
    /**
     * #slot
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bed.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),

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
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.bed.gz.tbi:
     * ```json
     * {
     *   "type": "BedTabixAdapter",
     *   "uri": "yourfile.bed.gz"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      // populate from just snap.uri
      return snap.uri
        ? {
            ...snap,
            bedGzLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              location: {
                uri: `${snap.uri}.tbi`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export default BedTabixAdapter
