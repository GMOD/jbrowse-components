import { lazy } from 'react'

import { pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { withContextMenuFeature } from '@jbrowse/plugin-alignments'
import AddIcon from '@mui/icons-material/Add'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

const ReadVsRefDialog = lazy(() => import('./LinearReadVsRef.tsx'))

function isDisplay(elt: { name: string }): elt is DisplayType {
  return elt.name === 'LinearAlignmentsDisplay'
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
            // Offered from the read id, which the hit test carries, so the item
            // is there when the menu opens rather than a fetch later; the
            // feature it needs is resolved in the onClick (normally already in
            // hand, since the fetch rebuilds this menu).
            contextMenuItems() {
              const featureId = self.contextMenuFeatureId
              const feature = self.contextMenuFeature
              const track = getContainingTrack(self)
              const items = superContextMenuItems()
              if (featureId !== undefined) {
                pushLaunchViewMenuItem(items, {
                  label: 'Linear read vs ref',
                  icon: AddIcon,
                  onClick: () => {
                    withContextMenuFeature(self, featureId, feature, feat => {
                      getSession(self).queueDialog(handleClose => [
                        ReadVsRefDialog,
                        {
                          track,
                          feature: feat,
                          handleClose,
                        },
                      ])
                    })
                  },
                })
              }
              return items
            },
          },
        }
      })
      return pluggableElement
    },
  )
}
