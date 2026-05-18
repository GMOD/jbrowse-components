import Plugin from '@jbrowse/core/Plugin'

import GWASAdapterF from './GWASAdapter/index.ts'
import GWASAddTrackComponentF from './GWASAddTrackComponent/index.tsx'
import GWASTrackF from './GWASTrack/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
import LinearManhattanDisplayF from './LinearManhattanDisplay/index.ts'
import ManhattanRPCF from './ManhattanRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GWASPlugin extends Plugin {
  name = 'GWASPlugin'

  install(pluginManager: PluginManager) {
    GWASAdapterF(pluginManager)
    GWASAddTrackComponentF(pluginManager)
    GWASTrackF(pluginManager)
    GuessAdapterF(pluginManager)
    LinearManhattanDisplayF(pluginManager)
    ManhattanRPCF(pluginManager)
  }
}
