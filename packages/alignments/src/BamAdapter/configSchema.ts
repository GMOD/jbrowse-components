import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { types } from 'mobx-state-tree'

export default (pluginManager: PluginManager) => {
  const index = ConfigurationSchema('BamIndex', {
    indexType: {
      model: types.enumeration('IndexType', ['BAI', 'CSI']),
      type: 'stringEnum',
      defaultValue: 'BAI',
    },
    location: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam.bai' },
    },
  })
  return types.late(() =>
    ConfigurationSchema(
      'BamAdapter',
      {
        bamLocation: {
          type: 'fileLocation',
          defaultValue: { uri: '/path/to/my.bam' },
        },
        index,
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
          defaultValue: {},
        },
      },
      { explicitlyTyped: true },
    ),
  )
}
