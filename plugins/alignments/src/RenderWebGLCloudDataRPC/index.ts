import RenderWebGLCloudData from './RenderWebGLCloudData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function WebGLCloudDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderWebGLCloudData(pm))
}
