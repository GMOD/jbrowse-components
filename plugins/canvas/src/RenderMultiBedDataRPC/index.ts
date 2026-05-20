import RenderMultiBedData from './RenderMultiBedData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RenderMultiBedDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderMultiBedData(pm))
}
