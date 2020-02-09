import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export { default as AdapterClass } from './BamAdapter'

export const configSchema = ConfigurationSchema(
  'BamAdapter',
  {
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam' },
    },
    index: ConfigurationSchema('BamIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.bam.bai' },
      },
    }),
    chunkSizeLimit: {
      type: 'number',
      defaultValue: 3000000,
    },
    fetchSizeLimit: {
      type: 'number',
      defaultValue: 5000000,
    },
  },
  { explicitlyTyped: true },
)
