import { extendDisplayType } from '@jbrowse/core/pluggableElementTypes'
import { pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { getContainingTrack } from '@jbrowse/core/util'
import {
  queueReadVsRefDialog,
  withContextMenuFeature,
} from '@jbrowse/plugin-alignments'
import AddIcon from '@mui/icons-material/Add'

import { launchLinearReadVsRef } from './launchLinearReadVsRef.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearReadVsRefMenuItemF(pm: PluginManager) {
  extendDisplayType(pm, 'LinearAlignmentsDisplay', stateModel =>
    stateModel.extend(self => {
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
                    queueReadVsRefDialog({
                      node: self,
                      track,
                      feature: feat,
                      onSubmit: launchLinearReadVsRef,
                    })
                  })
                },
              })
            }
            return items
          },
        },
      }
    }),
  )
}
