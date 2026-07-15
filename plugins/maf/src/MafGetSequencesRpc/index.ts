import MafGetSequences from './MafGetSequences.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafGetSequencesF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => {
    return new MafGetSequences(pluginManager)
  })
}
