import PluginManager from '@jbrowse/core/PluginManager'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

// icons
import AddIcon from '@mui/icons-material/Add'

// local
import { onClick } from './DotplotReadVsRef'

export default function DotplotReadVsRefMenuItem(pluginManager: PluginManager) {
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
