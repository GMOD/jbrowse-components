import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gff3TabixAdapterConfigSchema } from './Gff3TabixAdapter'
import { configSchema as gff3AdapterConfigSchema } from './Gff3Adapter'

export default class extends Plugin {
  name = 'GFF3Plugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'Gff3TabixAdapter',
          configSchema: gff3TabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./Gff3TabixAdapter/Gff3TabixAdapter').then(r => r.default),
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'Gff3Adapter',
          configSchema: gff3AdapterConfigSchema,
          getAdapterClass: () =>
            import('./Gff3Adapter/Gff3Adapter').then(r => r.default),
        }),
    )
  }
}
