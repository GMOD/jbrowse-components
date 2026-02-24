import RenderChainData from './RenderChainData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ChainDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderChainData(pm))
}
