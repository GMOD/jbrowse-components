// #exampleFile shared | registers the RPC method
import GetScoreData from './GetScoreData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ScoreRPCF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new GetScoreData(pluginManager))
}
