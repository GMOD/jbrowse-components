import { pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { getContainingTrack } from '@jbrowse/core/util'
import {
  queueReadVsRefDialog,
  withContextMenuFeature,
} from '@jbrowse/plugin-alignments'
import AddIcon from '@mui/icons-material/Add'

import { launchDotplotReadVsRef } from './DotplotReadVsRef.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  DisplayType,
  PluggableElementType,
} from '@jbrowse/core/pluggableElementTypes'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

// #region contextMenu
export default function DotplotReadVsRefMenuItem(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (pluggableElement.name === 'LinearAlignmentsDisplay') {
        const { stateModel } = pluggableElement as DisplayType
        const newStateModel = stateModel.extend(
          (self: LinearAlignmentsDisplayModel) => {
            const superContextMenuItems = self.contextMenuItems
            return {
              views: {
                // Offered from the read id, which the hit test carries, so the
                // item is there when the menu opens rather than a fetch later;
                // the feature it needs is resolved in the onClick (normally
                // already in hand, since the fetch rebuilds this menu).
                contextMenuItems() {
                  const featureId = self.contextMenuFeatureId
                  const feature = self.contextMenuFeature
                  const track = getContainingTrack(self)
                  const items = superContextMenuItems()
                  if (featureId !== undefined) {
                    pushLaunchViewMenuItem(items, {
                      label: 'Dotplot of read vs ref',
                      icon: AddIcon,
                      onClick: () => {
                        withContextMenuFeature(
                          self,
                          featureId,
                          feature,
                          feat => {
                            queueReadVsRefDialog({
                              node: self,
                              track,
                              feature: feat,
                              onSubmit: launchDotplotReadVsRef,
                            })
                          },
                        )
                      },
                    })
                  }
                  return items
                },
              },
            }
          },
        )

        ;(pluggableElement as DisplayType).stateModel = newStateModel
      }
      // every callback must return the element, extended or not — the point is
      // a chain, so swallowing it drops every later plugin's extensions too
      return pluggableElement
    },
  )
}
// #endregion
