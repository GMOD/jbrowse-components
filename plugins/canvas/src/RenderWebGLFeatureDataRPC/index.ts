import RenderWebGLFeatureData from './RenderWebGLFeatureData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLFeatureDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLFeatureData(pm))
}
