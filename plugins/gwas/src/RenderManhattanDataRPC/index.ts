import RenderManhattanData from './RenderManhattanData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RenderManhattanDataRPCF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new RenderManhattanData(pluginManager))
}
