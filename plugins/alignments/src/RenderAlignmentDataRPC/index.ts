import GetFeatureDetails from './GetFeatureDetails.ts'
import GetGlobalValueForTag from './GetGlobalValueForTag.ts'
import RenderAlignmentData from './RenderAlignmentData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PileupDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderAlignmentData(pm))
  pm.addRpcMethod(() => new GetFeatureDetails(pm))
  pm.addRpcMethod(() => new GetGlobalValueForTag(pm))
}
