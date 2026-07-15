import MultiRowClusterFeatures from './MultiRowClusterFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowClusterFeaturesRPCMethodF(pm: PluginManager) {
  pm.addRpcMethod(() => new MultiRowClusterFeatures(pm))
}
