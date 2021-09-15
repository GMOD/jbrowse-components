import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gtfTabixAdapterConfigSchema } from './GtfTabixAdapter'

export default class GtfPlugin extends Plugin {
  name = 'GtfPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GtfTabixAdapter',
          configSchema: gtfTabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./GtfTabixAdapter/GtfTabixAdapter').then(r => r.default),
        }),
    )
  }
}
