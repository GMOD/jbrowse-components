import MultiRowGetFeatures from './MultiRowGetFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowGetFeaturesRPCMethodF(pm: PluginManager) {
  pm.addRpcMethod(() => new MultiRowGetFeatures(pm))
}
