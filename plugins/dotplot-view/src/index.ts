import Plugin from '@jbrowse/core/Plugin'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import DotplotViewF from './DotplotView'
import DotplotDisplayF from './DotplotDisplay'
import DotplotRendererF from './DotplotRenderer'

import AddIcon from '@material-ui/icons/Add'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import TimelineIcon from '@material-ui/icons/Timeline'

import ComparativeRender from './DotplotRenderer/ComparativeRenderRpc'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'

import { onClick } from './DotplotReadVsRef'

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    DotplotViewF(pluginManager)
    DotplotDisplayF(pluginManager)
    DotplotRendererF(pluginManager)

    // install our comparative rendering rpc callback
    pluginManager.addRpcMethod(() => new ComparativeRender(pluginManager))

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
                        label: 'Dotplot of read vs ref',
                        icon: AddIcon,
                        onClick: () => onClick(feature, self),
                      },
                    ]

                    return newMenuItems
                  },
                },
              }
            },
          )

          ;(pluggableElement as ViewType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Dotplot view',
        icon: TimelineIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('DotplotView', {})
        },
      })
    }
  }
}
