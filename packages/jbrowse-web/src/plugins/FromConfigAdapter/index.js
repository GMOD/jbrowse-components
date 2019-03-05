import Plugin from '../../Plugin'
import AdapterType from '../../pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '../../configuration'

import AdapterClass from './FromConfigAdapter'

const configSchema = ConfigurationSchema(
  'FromConfigAdapter',
  {
    features: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)

export default class FromConfigAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'FromConfigAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
