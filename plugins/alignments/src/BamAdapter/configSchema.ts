import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default types.late(() =>
  ConfigurationSchema(
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
        defaultValue: 100000000,
      },
      fetchSizeLimit: {
        type: 'number',
        defaultValue: 500000000,
      },
      sequenceAdapter: {
        type: 'frozen',
        defaultValue: null,
      },
    },
    { explicitlyTyped: true },
  ),
)
