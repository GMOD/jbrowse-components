import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'

import CalendarIcon from '@mui/icons-material/CalendarViewDay'
import LGVSyntenyDisplayF from './LGVSyntenyDisplay'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView'
import LinearComparativeDisplayF from './LinearComparativeDisplay'
import LinearComparativeViewF from './LinearComparativeView'
import LinearReadVsRefMenuItemF from './LinearReadVsRef'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay'
import LinearSyntenyViewF from './LinearSyntenyView'
import LinearSyntenyViewHelperF from './LinearSyntenyViewHelper'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail'
import SyntenyTrackF from './SyntenyTrack'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

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
