import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  getSession,
  getContainingTrack,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'

import AddIcon from '@mui/icons-material/Add'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'
import LinearComparativeDisplayF from './LinearComparativeDisplay'
import LinearComparativeViewF from './LinearComparativeView'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay'
import LinearSyntenyRendererF from './LinearSyntenyRenderer'
import LinearSyntenyViewF from './LinearSyntenyView'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView'
import SyntenyTrackF from './SyntenyTrack'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail'
import { WindowSizeDlg } from './LinearReadVsRef'

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearPileupDisplay'
}

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
    LaunchLinearSyntenyViewF(pluginManager)
    SyntenyTrackF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (!isDisplay(pluggableElement)) {
          return pluggableElement
        }
        pluggableElement.stateModel = pluggableElement.stateModel.extend(
          self => {
            const superContextMenuItems = self.contextMenuItems
            return {
              views: {
                contextMenuItems() {
                  const feature = self.contextMenuFeature
                  return feature
                    ? [
                        ...superContextMenuItems(),
                        {
                          label: 'Linear read vs ref',
                          icon: AddIcon,
                          onClick: () => {
                            getSession(self).queueDialog(handleClose => [
                              WindowSizeDlg,
                              {
                                track: getContainingTrack(self),
                                feature,
                                handleClose,
                              },
                            ])
                          },
                        },
                      ]
                    : superContextMenuItems()
                },
              },
            }
          },
        )
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
