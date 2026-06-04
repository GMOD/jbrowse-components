import LinearMafGetSummaryData from './LinearMafGetSummaryData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMafGetSummaryDataF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new LinearMafGetSummaryData(pluginManager))
}
