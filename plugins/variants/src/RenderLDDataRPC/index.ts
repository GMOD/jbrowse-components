import RenderLDData from './RenderLDData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LDDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderLDData(pm))
}
