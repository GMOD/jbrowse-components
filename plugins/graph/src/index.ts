import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'

import GraphComputeLayout from './GraphComputeLayout.ts'
import GraphGenomeViewF from './GraphGenomeView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class GraphPlugin extends Plugin {
  name = 'GraphPlugin'

  install(pluginManager: PluginManager) {
    GraphGenomeViewF(pluginManager)
    pluginManager.addRpcMethod(() => new GraphComputeLayout(pluginManager))
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Graph genome view',
        icon: BubbleChartIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('GraphGenomeView', {})
        },
      })
    }
  }
}
