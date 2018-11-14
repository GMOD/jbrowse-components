import { types } from 'mobx-state-tree'
import Plugin, { AdapterType } from '../../Plugin'
import { ConfigurationSchema } from '../../configuration'
import AdapterClass from './BamAdapter'

const configSchema = ConfigurationSchema('BamAdapter', {
  bamLocation: {
    type: 'fileLocation',
    defaultValue: { uri: '/path/to/my.bam' },
  },
  index: ConfigurationSchema('BamIndex', {
    indexType: {
      model: types.union(types.literal('BAI'), types.literal('CSI')),
      type: 'string',
      defaultValue: 'BAI',
    },
    location: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam.bai' },
    },
  }),
})

export default class BamAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BamAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
