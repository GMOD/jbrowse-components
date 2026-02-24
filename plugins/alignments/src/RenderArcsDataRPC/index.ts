import RenderArcsData from './RenderArcsData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ArcsDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderArcsData(pm))
}
