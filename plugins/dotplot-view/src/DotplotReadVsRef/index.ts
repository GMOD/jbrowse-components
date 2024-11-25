import AddIcon from '@mui/icons-material/Add'
import { onClick } from './DotplotReadVsRef'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  DisplayType,
  PluggableElementType,
} from '@jbrowse/core/pluggableElementTypes'
import type { LinearPileupDisplayModel } from '@jbrowse/plugin-alignments'

// icons

// local

export default function DotplotReadVsRefMenuItem(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (pluggableElement.name === 'LinearPileupDisplay') {
        const { stateModel } = pluggableElement as DisplayType
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
                            onClick: () => {
                              onClick(feature, self)
                            },
                          },
                        ]
                      : []),
                  ]
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
