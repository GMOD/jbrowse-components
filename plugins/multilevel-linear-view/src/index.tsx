import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getSession,
  getContainingTrack,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import AddIcon from '@material-ui/icons/Add'
import CalendarIcon from '@material-ui/icons/CalendarViewDay'
import MultilevelLinearComparativeDisplayF from './MultilevelLinearComparativeDisplay'
import MultilevelLinearComparativeViewF from './MultilevelLinearComparativeView'
import MultilevelLinearDisplayF from './MultilevelLinearDisplay'
import MultilevelLinearRendererF from './MultilevelLinearRenderer'
import MultilevelLinearViewF from './MultilevelLinearView'
import MultilevelTrackF from './MultilevelTrack'
import { WindowSizeDlg } from './ReadVsRef'

export default class extends Plugin {
  name = 'MultilevelLinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(MultilevelLinearComparativeViewF),
    )
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(MultilevelLinearViewF),
    )
    MultilevelLinearRendererF(pluginManager)
    MultilevelLinearComparativeDisplayF(pluginManager)
    MultilevelLinearDisplayF(pluginManager)
    MultilevelTrackF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Linear multilevel view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('MultilevelLinearView', {})
        },
      })
    }
  }
}
