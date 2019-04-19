import Plugin from '../../Plugin'
import AdapterType from '../../pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '../../configuration'
import AdapterClass from './BigBedAdapter'

const configSchema = ConfigurationSchema(
  'BigBedAdapter',
  {
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb' },
    },
    assemblyName: {
      type: 'string',
      defaultValue: '',
    },
  },
  { explicitlyTyped: true },
)

export default class BigBedAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigBedAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
