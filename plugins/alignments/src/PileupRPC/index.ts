import PluginManager from '@jbrowse/core/PluginManager'
import {
  PileupGetGlobalValueForTag,
  PileupGetVisibleModifications,
  PileupGetReducedFeatures,
} from './rpcMethods'

export default function PileupRPCMethodsF(pm: PluginManager) {
  pm.addRpcMethod(() => new PileupGetGlobalValueForTag(pm))
  pm.addRpcMethod(() => new PileupGetVisibleModifications(pm))
  pm.addRpcMethod(() => new PileupGetReducedFeatures(pm))
}
