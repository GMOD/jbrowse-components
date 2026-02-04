import RenderWebGLPileupData from './RenderWebGLPileupData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLPileupDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLPileupData(pm))
}
