import Plugin from '@jbrowse/core/Plugin'

import BedAdapterF from './BedAdapter/index.ts'
import BedGraphAdapterF from './BedGraphAdapter/index.ts'
import BedGraphTabixAdapterF from './BedGraphTabixAdapter/index.ts'
import BedTabixAdapterF from './BedTabixAdapter/index.ts'
import BedpeAdapterF from './BedpeAdapter/index.ts'
import BigBedAdapterF from './BigBedAdapter/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'

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
