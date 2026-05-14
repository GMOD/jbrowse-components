import MafGetSamples from './MafGetSamples'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafGetSamplesF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => {
    return new MafGetSamples(pluginManager)
  })
}
