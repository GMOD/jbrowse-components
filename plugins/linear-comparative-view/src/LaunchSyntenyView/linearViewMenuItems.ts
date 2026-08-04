import { getConf } from '@jbrowse/core/configuration'
import { pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

import { anchorPanelTracks } from './anchorPanelTracks.ts'
import {
  syntenyRegionMenuItems,
  widestRegion,
} from './regionLaunchMenuItems.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VISIBLE_LABEL = 'Linear synteny view (visible region)'
const SELECTION_LABEL = 'Linear synteny view'

function isLinearGenomeView(elt: { name: string }): elt is ViewType {
  return elt.name === 'LinearGenomeView'
}

// "Open a synteny view on this locus" from the linear view itself, alongside the
// per-alignment "Launch synteny view for this position" in the LGVSyntenyDisplay
// right-click menu. The two answer different questions: that one follows the
// alignment under the cursor to its single mate, this one takes a locus and asks
// which assemblies align to it at all — which is the multi-panel view, and the
// only form that makes sense for an all-vs-all dataset.
//
// The selection entry is the useful one: a rubberband picks the locus directly,
// with no navigating first, and its bounds are exactly what the panels are
// clipped to. The visible-region entry is there for the whole-chromosome case,
// where the "region" is the view and there is nothing to select.
export default function LinearViewMenuItemsF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (pluggableElement: PluggableElementType) => {
      if (isLinearGenomeView(pluggableElement)) {
        pluggableElement.stateModel = pluggableElement.stateModel.extend(
          // Annotated rather than cast: the extension point hands over an
          // IAnyModelType, and stating the model shape here is what types
          // getSelectedRegions/dynamicBlocks below without an `as`.
          (self: LinearGenomeViewModel) => {
            const superMenuItems = self.menuItems
            const superLaunchMenuItems = self.rubberBandLaunchMenuItems
            // The two entries differ only in their label and which region they
            // read; everything else about the offer is the view's current state,
            // resolved at menu time so it is what is open as of the launch
            // rather than as of the extend(). `openTrackIds` sorts the dialog's
            // session-wide dataset list (see launchableTracks) and the tracks
            // are what the launched view's panel for this assembly opens with.
            const menuItemsFor = (label: string, region: Region | undefined) =>
              syntenyRegionMenuItems({
                label,
                region,
                session: getSession(self),
                openTrackIds: self.tracks.map(
                  track => getConf(track, 'trackId') as string,
                ),
                anchorTracks: anchorPanelTracks(self.tracks),
              })
            return {
              views: {
                menuItems() {
                  const items = superMenuItems()
                  for (const item of menuItemsFor(
                    VISIBLE_LABEL,
                    widestRegion(self.dynamicBlocks.contentBlocks),
                  )) {
                    pushLaunchViewMenuItem(items, item)
                  }
                  return items
                },

                // The view itself nests these under "Launch", so this
                // contributes the entry and nothing about where it sits.
                rubberBandLaunchMenuItems() {
                  return [
                    ...superLaunchMenuItems(),
                    ...menuItemsFor(
                      SELECTION_LABEL,
                      widestRegion(
                        self.getSelectedRegions(
                          self.leftOffset,
                          self.rightOffset,
                        ),
                      ),
                    ),
                  ]
                },
              },
            }
          },
        )
      }
      return pluggableElement
    },
  )
}
