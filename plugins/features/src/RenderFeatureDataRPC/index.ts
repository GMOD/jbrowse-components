import GetGroupByCandidates from './GetGroupByCandidates.ts'
import RenderFeatureData from './RenderFeatureData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderFeatureData(pm))
  pm.addRpcMethod(() => new GetGroupByCandidates(pm))
}
