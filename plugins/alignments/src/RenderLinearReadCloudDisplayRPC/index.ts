import RenderLinearReadCloudDisplay from './RenderLinearReadCloudDisplay.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearReadCloudDisplayRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderLinearReadCloudDisplay(pm))
}
