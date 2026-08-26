import { addDisplayMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import { getContainingTrack } from '@jbrowse/core/util'
import {
  queueReadVsRefDialog,
  withContextMenuFeature,
} from '@jbrowse/plugin-alignments'
import AddIcon from '@mui/icons-material/Add'

import { launchDotplotReadVsRef } from './DotplotReadVsRef.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// #region contextMenu
export default function DotplotReadVsRefMenuItem(pluginManager: PluginManager) {
  addDisplayMenuItems(pluginManager, 'LinearAlignmentsDisplay', {
    menu: 'contextMenuItems',
    group: LAUNCH_LABEL,
    // Offered from the read id, which the hit test carries, so the item is
    // there when the menu opens rather than a fetch later; the feature it needs
    // is resolved in the onClick (normally already in hand, since the fetch
    // rebuilds this menu).
    items: self => {
      const featureId = self.contextMenuFeatureId
      const feature = self.contextMenuFeature
      const track = getContainingTrack(self)
      return featureId === undefined
        ? undefined
        : {
            label: 'Dotplot of read vs ref',
            icon: AddIcon,
            onClick: () => {
              withContextMenuFeature(self, featureId, feature, feat => {
                queueReadVsRefDialog({
                  node: self,
                  track,
                  feature: feat,
                  onSubmit: launchDotplotReadVsRef,
                })
              })
            },
          }
    },
  })
}
// #endregion
