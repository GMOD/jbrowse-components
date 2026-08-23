import ArcGetFeatures from './ArcGetFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ArcGetFeaturesRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new ArcGetFeatures(pm))
}
