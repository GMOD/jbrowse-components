import RenderWebGLChainData from './RenderWebGLChainData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLChainDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLChainData(pm))
}
