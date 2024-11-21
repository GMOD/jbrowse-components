import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'

// locals

import CircularViewF from './CircularView'
import LaunchCircularViewF from './LaunchCircularView'

// icons
import DataUsageIcon from '@mui/icons-material/DataUsage'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    CircularViewF(pluginManager)
    LaunchCircularViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Circular view',
        icon: DataUsageIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('CircularView', {})
        },
      })
    }
  }
}

export {
  baseChordDisplayConfig,
  BaseChordDisplayModel,
  BaseChordDisplayComponent,
} from './BaseChordDisplay'

export {
  type CircularViewModel,
  type CircularViewStateModel,
} from './CircularView/models/model'
