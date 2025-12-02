import RenderLinearReadArcsDisplay from './RenderLinearReadArcsDisplay'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearReadArcsDisplayRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderLinearReadArcsDisplay(pm))
}
