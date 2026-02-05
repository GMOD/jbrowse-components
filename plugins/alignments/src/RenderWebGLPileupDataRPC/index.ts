import RenderWebGLPileupData from './RenderWebGLPileupData.ts'
import WebGLGetFeatureDetails from './WebGLGetFeatureDetails.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLPileupDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLPileupData(pm))
  pm.addRpcMethod(() => new WebGLGetFeatureDetails(pm))
}
