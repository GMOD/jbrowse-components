import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'BedAdapter',
  {
    bedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bed.gz', locationType: 'UriLocation' },
    },

    columnNames: {
      type: 'stringArray',
      description: 'List of column names',
      defaultValue: [],
    },

    scoreColumn: {
      type: 'string',
      description: 'The column to use as a "score" attribute',
      defaultValue: '',
    },

    autoSql: {
      type: 'string',
      description: 'The autoSql definition for the data fields in the file',
      defaultValue: '',
    },
    colRef: {
      type: 'number',
      description: 'The column to use as a "refName" attribute',
      defaultValue: 0,
    },
    colStart: {
      type: 'number',
      description: 'The column to use as a "start" attribute',
      defaultValue: 1,
    },
    colEnd: {
      type: 'number',
      description: 'The column to use as a "end" attribute',
      defaultValue: 2,
    },
  },
  { explicitlyTyped: true },
)
