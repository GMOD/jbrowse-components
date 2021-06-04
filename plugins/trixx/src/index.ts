import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as TrixxTextSearchAdapterClass,
  configSchema as trixxAdapterConfigSchema,
} from './TrixxTextSearchAdapter'

export default class extends Plugin {
  name = 'TrixxPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addTextSearchAdapterType(
      () =>
        new TextSearchAdapterType({
          name: 'TrixxTextSearchAdapter',
          configSchema: trixxAdapterConfigSchema,
          AdapterClass: TrixxTextSearchAdapterClass,
          description: 'Trixx adapter',
        }),
    )
  }
}
