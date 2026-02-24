import RenderHicData from './RenderHicData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function HicDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderHicData(pm))
}
