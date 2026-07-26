import { pushLaunchViewMenuItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

import { syntenyRegionMenuItems } from './regionLaunchMenuItems.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VISIBLE_LABEL = 'Linear synteny view (visible region)'
const SELECTION_LABEL = 'Linear synteny view of selection'

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
            const superRubberBandMenuItems = self.rubberBandMenuItems
            return {
              views: {
                menuItems() {
                  const items = superMenuItems()
                  for (const item of syntenyRegionMenuItems({
                    label: VISIBLE_LABEL,
                    // the first content block: a view scrolled across a region
                    // boundary has several, and a synteny panel is anchored on
                    // one stable sequence
                    region: self.dynamicBlocks.contentBlocks[0],
                    session: getSession(self),
                  })) {
                    pushLaunchViewMenuItem(items, item)
                  }
                  return items
                },

                // The rubberband menu is short and contextual, so this goes in
                // flat rather than under a "Launch view" submenu — that grouping
                // earns its keep in the long view menu, not here.
                rubberBandMenuItems() {
                  return [
                    ...superRubberBandMenuItems(),
                    ...syntenyRegionMenuItems({
                      label: SELECTION_LABEL,
                      region: self.getSelectedRegions(
                        self.leftOffset,
                        self.rightOffset,
                      )[0],
                      session: getSession(self),
                    }),
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
