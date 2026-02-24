import RenderWiggleData from './RenderWiggleData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RenderWiggleDataRPCF(
  pluginManager: PluginManager,
) {
  pluginManager.addRpcMethod(() => new RenderWiggleData(pluginManager))
}
