import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'

import Gff3TabixAdapterF from './Gff3TabixAdapter'
import Gff3AdapterF from './Gff3Adapter'
import GuessGff3F from './GuessGff3'

export default class GFF3Plugin extends Plugin {
  name = 'GFF3Plugin'

  install(pluginManager: PluginManager) {
    Gff3TabixAdapterF(pluginManager)
    Gff3AdapterF(pluginManager)
    GuessGff3F(pluginManager)
  }
}
