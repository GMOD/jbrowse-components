import Plugin from '@jbrowse/core/Plugin'

import Gff3AdapterF from './Gff3Adapter'
import Gff3TabixAdapterF from './Gff3TabixAdapter'
import GuessGff3F from './GuessGff3'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class GFF3Plugin extends Plugin {
  name = 'GFF3Plugin'

  install(pluginManager: PluginManager) {
    Gff3TabixAdapterF(pluginManager)
    Gff3AdapterF(pluginManager)
    GuessGff3F(pluginManager)
  }
}
