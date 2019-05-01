import Plugin from '@gmod/jbrowse-core/Plugin'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import AdapterClass from './BigBedAdapter'

const configSchema = ConfigurationSchema(
  'BigBedAdapter',
  {
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bb' },
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
