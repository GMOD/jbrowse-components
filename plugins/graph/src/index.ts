import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'

import GraphGenomeViewF from './GraphGenomeView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class GraphPlugin extends Plugin {
  name = 'GraphPlugin'

  install(pluginManager: PluginManager) {
    GraphGenomeViewF(pluginManager)
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

  rootConfigurationSchema = (_pluginManager: PluginManager) => ({
    graphGenome: ConfigurationSchema('GraphGenome', {
      datasets: types.maybe(
        types.array(
          ConfigurationSchema('GraphGenomeDataset', {
            name: {
              type: 'string',
              defaultValue: '',
              description: 'Display name for this graph dataset',
            },
            gfaLocation: {
              type: 'fileLocation',
              defaultValue: { uri: '', locationType: 'UriLocation' },
              description: 'Location of the GFA file',
            },
          }),
        ),
      ),
    }),
  })
}
