import GetFeatureDetails from './GetFeatureDetails.ts'
import RenderFeatureData from './RenderFeatureData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function FeatureDataRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new RenderFeatureData(pm))
  pm.addRpcMethod(() => new GetFeatureDetails(pm))
}
