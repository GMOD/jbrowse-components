import Plugin from '@jbrowse/core/Plugin'

import LinearMarkDisplayF from './LinearMarkDisplay/index.ts'
import MarkRowsRPCF from './MarkRowsRPC/index.ts'
import MarkScanPlotFields from './MarkScanPlotFields.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class MarksPlugin extends Plugin {
  name = 'MarksPlugin'

  install(pluginManager: PluginManager) {
    LinearMarkDisplayF(pluginManager)
    MarkRowsRPCF(pluginManager)
    pluginManager.addRpcMethod(() => new MarkScanPlotFields(pluginManager))
  }
}
