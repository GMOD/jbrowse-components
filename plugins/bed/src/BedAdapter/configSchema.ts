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
    autoSql: {
      defaultValue: '',
      description: 'The autoSql definition for the data fields in the file',
      type: 'string',
    },

    /**
     * #slot
     */
    bedLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.bed.gz' },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    colEnd: {
      defaultValue: 2,
      description: 'The column to use as a "end" attribute',
      type: 'number',
    },

    /**
     * #slot
     */
    colRef: {
      defaultValue: 0,
      description: 'The column to use as a "refName" attribute',
      type: 'number',
    },

    /**
     * #slot
     */
    colStart: {
      defaultValue: 1,
      description: 'The column to use as a "start" attribute',
      type: 'number',
    },

    /**
     * #slot
     */
    columnNames: {
      defaultValue: [],
      description: 'List of column names',
      type: 'stringArray',
    },

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
export default BedAdapter
