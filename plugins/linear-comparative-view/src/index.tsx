import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import CalendarIcon from '@mui/icons-material/CalendarViewDay'
import LinearComparativeDisplayF from './LinearComparativeDisplay'
import LinearComparativeViewF from './LinearComparativeView'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay'
import LGVSyntenyDisplayF from './LGVSyntenyDisplay'
import LinearSyntenyViewF from './LinearSyntenyView'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView'
import SyntenyTrackF from './SyntenyTrack'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail'
import LinearReadVsRefMenuItem from './LinearReadVsRef'

export default class extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    LinearComparativeViewF(pluginManager)
    LinearSyntenyViewF(pluginManager)
    LinearComparativeDisplayF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    LGVSyntenyDisplayF(pluginManager)
    LaunchLinearSyntenyViewF(pluginManager)
    SyntenyTrackF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)
    LinearReadVsRefMenuItem(pluginManager)
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
