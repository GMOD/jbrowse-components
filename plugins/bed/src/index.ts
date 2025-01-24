import Plugin from '@jbrowse/core/Plugin'

import BedAdapterF from './BedAdapter'
import BedGraphAdapterF from './BedGraphAdapter'
import BedGraphTabixAdapterF from './BedGraphTabixAdapter'
import BedTabixAdapterF from './BedTabixAdapter'
import BedpeAdapterF from './BedpeAdapter'
import BigBedAdapterF from './BigBedAdapter'
import GuessAdapterF from './GuessAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class BedPlugin extends Plugin {
  name = 'BedPlugin'

  install(pluginManager: PluginManager) {
    BigBedAdapterF(pluginManager)
    BedAdapterF(pluginManager)
    BedpeAdapterF(pluginManager)
    BedTabixAdapterF(pluginManager)
    BedGraphAdapterF(pluginManager)
    BedGraphTabixAdapterF(pluginManager)
    GuessAdapterF(pluginManager)
  }
}
