import PluginManager from '@jbrowse/core/PluginManager'
import {
  PluggableElementType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'

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
                  return [
                    ...superContextMenuItems(),
                    ...(feature
                      ? [
                          {
                            label: 'Dotplot of read vs ref',
                            icon: AddIcon,
                            onClick: () => onClick(feature, self),
                          },
                        ]
                      : []),
                  ]
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
