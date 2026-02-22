import RenderWebGLHicData from './RenderWebGLHicData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLHicDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLHicData(pm))
}
