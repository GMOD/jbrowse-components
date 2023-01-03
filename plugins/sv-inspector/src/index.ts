import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@jbrowse/core/util/types'

// icons
import TableChartIcon from '@mui/icons-material/TableChart'

// locals
import SvInspectorViewF from './SvInspectorView'
import LaunchSvInspectorViewF from './LaunchSvInspectorView'

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
