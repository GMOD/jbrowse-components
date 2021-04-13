import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { configSchema as bigBedAdapterConfigSchema } from './BigBedAdapter'
import { configSchema as bedTabixAdapterConfigSchema } from './BedTabixAdapter'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigBedAdapter',
          configSchema: bigBedAdapterConfigSchema,
          getAdapterClass: () =>
            import('./BigBedAdapter/BigBedAdapter').then(r => r.default),
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BedTabixAdapter',
          configSchema: bedTabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./BedTabixAdapter/BedTabixAdapter').then(r => r.default),
        }),
    )
  }
}
