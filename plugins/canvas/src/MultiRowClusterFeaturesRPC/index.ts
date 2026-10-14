import MultiRowClusterFeatures from './MultiRowClusterFeatures.ts'
import MultiRowGetFeatureMatrix from './MultiRowGetFeatureMatrix.ts'
import MultiRowValuesAt from './MultiRowValuesAt.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowClusterFeaturesRPCMethodF(pm: PluginManager) {
  pm.addRpcMethod(() => new MultiRowClusterFeatures(pm))
  pm.addRpcMethod(() => new MultiRowGetFeatureMatrix(pm))
  pm.addRpcMethod(() => new MultiRowValuesAt(pm))
}
