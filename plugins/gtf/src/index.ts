import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gtfTabixAdapterConfigSchema } from './GtfTabixAdapter'

export default class extends Plugin {
  name = 'GTFTabixAdapter'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GtfTabixAdapter',
          configSchema: gff3TabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./GtfTabixAdapter/GtfTabixAdapter').then(r => r.default),
        }),
    )
  }
}
