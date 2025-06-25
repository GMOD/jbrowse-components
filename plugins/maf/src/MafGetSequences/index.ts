import PluginManager from '@jbrowse/core/PluginManager'

import MafGetSequences from './MafGetSequences'

export default function MafGetSequencesF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => {
    return new MafGetSequences(pluginManager)
  })
}
