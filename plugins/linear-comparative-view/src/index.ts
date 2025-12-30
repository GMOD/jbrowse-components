import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'

import LGVSyntenyDisplayF from './LGVSyntenyDisplay/index.ts'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView.ts'
import LinearComparativeDisplayF from './LinearComparativeDisplay/index.ts'
import LinearComparativeViewF from './LinearComparativeView/index.ts'
import LinearReadVsRefMenuItemF from './LinearReadVsRef/index.ts'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay/index.ts'
import LinearSyntenyViewF from './LinearSyntenyView/index.ts'
import LinearSyntenyViewHelperF from './LinearSyntenyViewHelper/index.tsx'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail/index.ts'
import SyntenyTrackF from './SyntenyTrack/index.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { LinearSyntenyImportFormSyntenyOption } from './LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx'
export type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'

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
