import RenderLinearReadArcsDisplay from './RenderLinearReadArcsDisplay.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearReadArcsDisplayRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderLinearReadArcsDisplay(pm))
}
