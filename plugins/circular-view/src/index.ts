import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import DataUsageIcon from '@mui/icons-material/DataUsage'

import CircularViewF from './CircularView'
import LaunchCircularViewF from './LaunchCircularView'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

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
  type CircularViewModel,
  type CircularViewStateModel,
  type ExportSvgOptions,
} from './CircularView/model'
