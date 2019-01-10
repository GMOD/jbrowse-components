import { types } from 'mobx-state-tree'
import Plugin from '../../Plugin'
import AdapterType from '../../pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '../../configuration'
import AdapterClass from './TwoBitAdapter'

const configSchema = ConfigurationSchema(
  'TwoBitAdapter',
  {
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.2bit' },
    },
    assemblyName: {
      type: 'string',
      defaultValue: '',
    },
  },
  { explicitlyTyped: true },
)

export default class TwoBitAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'TwoBitAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
