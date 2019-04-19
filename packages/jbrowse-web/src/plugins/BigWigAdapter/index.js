import Plugin from '@gmod/jbrowse-core/Plugin'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import AdapterClass from './BigWigAdapter'

const configSchema = ConfigurationSchema(
  'BigWigAdapter',
  {
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bw' },
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
