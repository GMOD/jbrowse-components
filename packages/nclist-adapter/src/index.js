import Plugin from '@gmod/jbrowse-core/Plugin'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import AdapterClass from './NCListAdapter'

const configSchema = ConfigurationSchema(
  'NCListAdapter',
  {
    rootUrlTemplate: {
      type: 'string',
      defaultValue: '/path/to/my/{refseq}/trackData.json',
    },
  },
  { explicitlyTyped: true },
)

export default class NCListAdapterPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'NCListAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
