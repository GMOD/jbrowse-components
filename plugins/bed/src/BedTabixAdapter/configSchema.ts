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
    autoSql: {
      defaultValue: '',
      description: 'The autoSql definition for the data fields in the file',
      type: 'string',
    },

    /**
     * #slot
     */
    bedGzLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bed.gz' },
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

    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      },
      /**
       * #slot index.location
       */
      location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.bed.gz.tbi',
        },
        type: 'fileLocation',
      },
    }),

    /**
     * #slot
     */
    scoreColumn: {
      defaultValue: '',
      description: 'The column to use as a "score" attribute',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default BedTabixAdapter
