import { addViewMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { LAUNCH_VIEW_LABEL } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

import { containingPanelStack } from '../LGVSyntenyDisplay/matePanelNavigation.ts'
import { anchorPanelTracks } from './anchorPanelTracks.ts'
import {
  syntenyRegionMenuItems,
  widestRegion,
} from './regionLaunchMenuItems.ts'
import { launchableTrackConfs } from './stackSyntenyTracks.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VISIBLE_LABEL = 'Linear synteny view (visible region)'
const SELECTION_LABEL = 'Linear synteny view'

// The two entries differ only in their label and which region they read;
// everything else about the offer is the view's current state, resolved at menu
// time so it is what is open as of the launch rather than as of registration.
// The open tracks are read twice over, for two different purposes: the synteny
// ones among them — and the bands' tracks, when this view is a row of a stack
// (see launchableTrackConfs) — are the datasets the dialog offers to cut panels
// from, and the rest are what the launched view's panel for this assembly opens
// with.
//
// A ROW OFFERS TO REPLACE ITS STACK, not itself. The launched view is a stack
// anchored on this row's genome, so the one it can stand in for is the stack
// the row came from — a row has no slot of its own in the session, and offering
// it would offer nothing.
function menuItemsFor(
  self: LinearGenomeViewModel,
  label: string,
  region: Region | undefined,
) {
  return syntenyRegionMenuItems({
    label,
    region,
    session: getSession(self),
    openTracks: launchableTrackConfs(self),
    anchorTracks: anchorPanelTracks(self.tracks),
    sourceView: containingPanelStack(self) ?? self,
  })
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
  addViewMenuItems(pluginManager, 'LinearGenomeView', {
    menu: 'menuItems',
    group: LAUNCH_VIEW_LABEL,
    items: self =>
      menuItemsFor(
        self,
        VISIBLE_LABEL,
        widestRegion(self.dynamicBlocks.contentBlocks),
      ),
  })

  // The view itself nests these under "Launch", so this contributes the entry
  // and nothing about where it sits.
  addViewMenuItems(pluginManager, 'LinearGenomeView', {
    menu: 'rubberBandLaunchMenuItems',
    items: self =>
      menuItemsFor(
        self,
        SELECTION_LABEL,
        widestRegion(
          self.getSelectedRegions(self.leftOffset, self.rightOffset),
        ),
      ),
  })
}
