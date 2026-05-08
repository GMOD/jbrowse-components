import Plugin from '@jbrowse/core/Plugin'

import GuessAdapterF from './GuessAdapter/index.ts'
import HicAdapterF from './HicAdapter/index.ts'
import HicTrackF from './HicTrack/index.ts'
import LinearHicDisplayF from './LinearHicDisplay/index.ts'
import HicDataRPCMethodsF from './RenderHicDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    HicAdapterF(pluginManager)
    HicTrackF(pluginManager)
    LinearHicDisplayF(pluginManager)
    HicDataRPCMethodsF(pluginManager)
    GuessAdapterF(pluginManager)
  }
}
