import GetManhattanData from './GetManhattanData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ManhattanRPCF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new GetManhattanData(pluginManager))
}
