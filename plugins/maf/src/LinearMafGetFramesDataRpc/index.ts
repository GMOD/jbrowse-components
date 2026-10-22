import LinearMafGetFramesData from './LinearMafGetFramesData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMafGetFramesDataF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new LinearMafGetFramesData(pluginManager))
}
