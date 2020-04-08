import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export { default as AdapterClass } from './BedTabixAdapter.ts'

export const configSchema = ConfigurationSchema(
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
  },
  { explicitlyTyped: true },
)
