import { types } from 'mobx-state-tree'
import Plugin from '../../Plugin'
import AdapterType from '../../pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '../../configuration'
import AdapterClass from './BigWigAdapter'

const configSchema = ConfigurationSchema(
  'BigWigAdapter',
  {
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bw' },
    },
    assemblyName: {
      type: 'string',
      defaultValue: '',
    },
  },
  { explicitlyTyped: true },
)

export default class BigWigAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigWigAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
