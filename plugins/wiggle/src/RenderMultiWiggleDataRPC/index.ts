import RenderMultiWiggleData from './RenderMultiWiggleData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RenderMultiWiggleDataRPCF(
  pluginManager: PluginManager,
) {
  pluginManager.addRpcMethod(() => new RenderMultiWiggleData(pluginManager))
}
