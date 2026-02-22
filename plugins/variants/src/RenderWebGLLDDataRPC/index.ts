import RenderWebGLLDData from './RenderWebGLLDData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLLDDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLLDData(pm))
}
