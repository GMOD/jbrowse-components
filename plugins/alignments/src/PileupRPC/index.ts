import PileupGetGlobalValueForTag from './methods/GetGlobalValueForTag.ts'
import PileupGetVisibleModifications from './methods/GetVisibleModifications.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PileupRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new PileupGetGlobalValueForTag(pm))
  pm.addRpcMethod(() => new PileupGetVisibleModifications(pm))
}
