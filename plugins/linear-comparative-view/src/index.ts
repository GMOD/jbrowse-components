import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import CalendarIcon from '@mui/icons-material/CalendarViewDay'
import LinearComparativeDisplayF from './LinearComparativeDisplay'
import LinearComparativeViewF from './LinearComparativeView'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay'
import LGVSyntenyDisplayF from './LGVSyntenyDisplay'
import LinearSyntenyViewF from './LinearSyntenyView'
import LinearSyntenyViewHelperF from './LinearSyntenyViewHelper'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView'
import SyntenyTrackF from './SyntenyTrack'
import LinearReadVsRefMenuItemF from './LinearReadVsRef'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail'

export default class LinearComparativeViewPlugin extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    LinearSyntenyViewHelperF(pluginManager)
    LinearComparativeViewF(pluginManager)
    LinearSyntenyViewF(pluginManager)
    LinearComparativeDisplayF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)
    LGVSyntenyDisplayF(pluginManager)
    LaunchLinearSyntenyViewF(pluginManager)
    SyntenyTrackF(pluginManager)
    LinearReadVsRefMenuItemF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }
  }
}
