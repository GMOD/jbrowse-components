import RenderWebGLMultiWiggleData from './RenderWebGLMultiWiggleData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RenderWebGLMultiWiggleDataRPCF(
  pluginManager: PluginManager,
) {
  pluginManager.addRpcMethod(
    () => new RenderWebGLMultiWiggleData(pluginManager),
  )
}
