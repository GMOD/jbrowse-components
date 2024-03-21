import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import { getSession, getContainingTrack } from '@jbrowse/core/util'

// icons
import AddIcon from '@mui/icons-material/Add'

// locals
const ReadVsRefDialog = lazy(() => import('./LinearReadVsRef'))

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearPileupDisplay'
}

export default function (pm: PluginManager) {
  pm.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (!isDisplay(pluggableElement)) {
        return pluggableElement
      }
      pluggableElement.stateModel = pluggableElement.stateModel.extend(self => {
        const superContextMenuItems = self.contextMenuItems
        return {
          views: {
            contextMenuItems() {
              const feature = self.contextMenuFeature
              const track = getContainingTrack(self)
              return [
                ...superContextMenuItems(),
                ...(feature
                  ? [
                      {
                        icon: AddIcon,
                        label: 'Linear read vs ref',
                        onClick: () => {
                          getSession(self).queueDialog(handleClose => [
                            ReadVsRefDialog,
                            {
                              feature,
                              handleClose,
                              track,
                            },
                          ])
                        },
                      },
                    ]
                  : []),
              ]
            },
          },
        }
      })
      return pluggableElement
    },
  )
}
