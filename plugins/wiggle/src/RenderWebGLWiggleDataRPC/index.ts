import RenderWebGLWiggleData from './RenderWebGLWiggleData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RenderWebGLWiggleDataRPCF(
  pluginManager: PluginManager,
) {
  pluginManager.addRpcMethod(() => new RenderWebGLWiggleData(pluginManager))
}
