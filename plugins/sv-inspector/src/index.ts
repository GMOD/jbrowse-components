import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util/types'

// icons
import TableChartIcon from '@mui/icons-material/TableChart'

// locals
import LaunchSvInspectorViewF from './LaunchSvInspectorView'
import SvInspectorViewF from './SvInspectorView'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'

export default class SvInspectorViewPlugin extends Plugin {
  name = 'SvInspectorViewPlugin'

  install(pluginManager: PluginManager) {
    SvInspectorViewF(pluginManager)
    LaunchSvInspectorViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'SV inspector',
        icon: TableChartIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SvInspectorView', {})
        },
      })
    }
  }
}
