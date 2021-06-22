import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as TrixTextSearchAdapterClass,
  configSchema as trixAdapterConfigSchema,
} from './TrixTextSearchAdapter'

export default class extends Plugin {
  name = 'TrixPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTextSearchAdapterType(
      () =>
        new TextSearchAdapterType({
          name: 'TrixTextSearchAdapter',
          configSchema: trixAdapterConfigSchema,
          AdapterClass: TrixTextSearchAdapterClass,
          description: 'Trix adapter',
        }),
    )
  }
}
