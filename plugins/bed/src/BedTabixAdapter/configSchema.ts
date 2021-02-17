import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'BedTabixAdapter',
  {
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bed.gz' },
    },

    index: ConfigurationSchema('TabixIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.bed.gz.tbi' },
      },
    }),

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
  },
  { explicitlyTyped: true },
)
