import { lazy } from 'react'

import { getContainingTrack, getSession } from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

const ReadVsRefDialog = lazy(() => import('./LinearReadVsRef.tsx'))

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearPileupDisplay'
}

export default function LinearReadVsRefMenuItemF(pm: PluginManager) {
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
                        label: 'Linear read vs ref',
                        icon: AddIcon,
                        onClick: () => {
                          getSession(self).queueDialog(handleClose => [
                            ReadVsRefDialog,
                            {
                              track,
                              feature,
                              handleClose,
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
