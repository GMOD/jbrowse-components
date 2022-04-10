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

import AddIcon from '@mui/icons-material/Add'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'
import LinearComparativeDisplayF from './LinearComparativeDisplay'
import LinearComparativeViewF from './LinearComparativeView'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay'
import LinearSyntenyRendererF from './LinearSyntenyRenderer'
import LinearSyntenyViewF from './LinearSyntenyView'
import SyntenyTrackF from './SyntenyTrack'
import { WindowSizeDlg } from './ReadVsRef'

export default class extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(LinearComparativeViewF),
    )
    pluginManager.addViewType(() => pluginManager.jbrequire(LinearSyntenyViewF))
    LinearSyntenyRendererF(pluginManager)
    LinearComparativeDisplayF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    SyntenyTrackF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearPileupDisplay') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(
            (self: LinearPileupDisplayModel) => {
              const superContextMenuItems = self.contextMenuItems
              return {
                views: {
                  contextMenuItems() {
                    const feature = self.contextMenuFeature
                    if (!feature) {
                      return superContextMenuItems()
                    }
                    const newMenuItems = [
                      ...superContextMenuItems(),
                      {
                        label: 'Linear read vs ref',
                        icon: AddIcon,
                        onClick: () => {
                          getSession(self).queueDialog(doneCallback => [
                            WindowSizeDlg,
                            {
                              track: getContainingTrack(self),
                              feature,
                              handleClose: doneCallback,
                            },
                          ])
                        },
                      },
                    ]

                    return newMenuItems
                  },
                },
              }
            },
          )

          ;(pluggableElement as DisplayType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
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
