import LinearMafGetAlignmentData from './LinearMafGetAlignmentData'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMafGetAlignmentDataF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new LinearMafGetAlignmentData(pluginManager))
}
