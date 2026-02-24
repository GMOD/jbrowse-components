import RenderPileupData from './RenderPileupData.ts'
import GetFeatureDetails from './GetFeatureDetails.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PileupDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderPileupData(pm))
  pm.addRpcMethod(() => new GetFeatureDetails(pm))
}
