import Plugin from '@jbrowse/core/Plugin'

import GWASAdapterF from './GWASAdapter/index.ts'
import GWASAddTrackComponentF from './GWASAddTrackComponent/index.tsx'
import GWASTrackF from './GWASTrack/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
import LinearManhattanDisplayF from './LinearManhattanDisplay/index.ts'
import JexlMouseoverF from './LinearManhattanDisplay/jexlMouseover.ts'
import LinearManhattanRendererF from './LinearManhattanRenderer/index.ts'
import RenderManhattanDataRPCF from './RenderManhattanDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GWASPlugin extends Plugin {
  name = 'GWASPlugin'

  install(pluginManager: PluginManager) {
    GWASAdapterF(pluginManager)
    GWASAddTrackComponentF(pluginManager)
    GWASTrackF(pluginManager)
    GuessAdapterF(pluginManager)
    LinearManhattanDisplayF(pluginManager)
    LinearManhattanRendererF(pluginManager)
    JexlMouseoverF(pluginManager)
    RenderManhattanDataRPCF(pluginManager)
  }
}
