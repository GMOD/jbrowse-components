import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import { configSchema as gff3TabixAdapterConfigSchema } from './Gff3TabixAdapter'

export default class extends Plugin {
  name = 'GFF3TabixPlugin'

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
  }
}
