import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed'
import MultilevelLinearViewF from './MultilevelLinearView'
import LinearGenomeMultilevelViewF from './LinearGenomeMultilevelView'
import MiniControls from './MultilevelLinearView/components/MiniControls'
import Header from './MultilevelLinearView/components/Header'

export default class extends Plugin {
  name = 'MultilevelLinearViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearGenomeMultilevelViewF),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(MultilevelLinearViewF),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Linear multilevel view',
        icon: DynamicFeedIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('MultilevelLinearView', {})
        },
      })
    }
  }
}
