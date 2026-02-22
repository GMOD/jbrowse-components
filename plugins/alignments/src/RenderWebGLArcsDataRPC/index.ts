import RenderWebGLArcsData from './RenderWebGLArcsData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLArcsDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLArcsData(pm))
}
