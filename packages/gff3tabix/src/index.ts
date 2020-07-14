import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  AdapterClass as Gff3TabixAdapterClass,
  configSchema as gff3TabixAdapterConfigSchema,
} from './Gff3TabixAdapter'

export default class extends Plugin {
  name = 'GFF3TabixPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'Gff3TabixAdapter',
          configSchema: gff3TabixAdapterConfigSchema,
          AdapterClass: Gff3TabixAdapterClass,
        }),
    )
  }
}
