import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import DynamicFeedIcon from '@material-ui/icons/DynamicFeed'
import MultilevelLinearComparativeDisplayF from './MultilevelLinearComparativeDisplay'
import MultilevelLinearComparativeViewF from './MultilevelLinearComparativeView'
import MultilevelLinearDisplayF from './MultilevelLinearDisplay'
import MultilevelLinearViewF from './MultilevelLinearView'
import MultilevelTrackF from './MultilevelTrack'

export default class extends Plugin {
  name = 'MultilevelLinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(MultilevelLinearComparativeViewF),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(MultilevelLinearViewF),
    )
    MultilevelLinearComparativeDisplayF(pluginManager)
    MultilevelLinearDisplayF(pluginManager)
    MultilevelTrackF(pluginManager)
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
