import { getSession, withFeatureDetails } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import {
  getAssemblyName,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
  makeFindJunctionsNear,
} from '@jbrowse/sv-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import { SPLIT_VIEW_MENU_LABEL } from '../LinearVariantDisplay/labels.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// What launching the dialog needs from the display it was invoked on.
// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any` and
// silently stops checking `adapterConfig`.
interface BreakendLaunchSelf extends IStateTreeNode {
  // what `makeFindJunctionsNear` queries to continue a chain past this record
  adapterConfig: Record<string, unknown>
  // the record as the adapter holds it: the click's own carries no INFO, and
  // the junction walk reads its MATEID, EVENT and FILTER
  fetchFullRecord(feature: Feature): Promise<Feature>
}

/**
 * The "open breakpoint split view" row, launched from the full record the
 * clicked one names.
 *
 * Gated on the feature's own type rather than on parsing its ALT: `VcfFeature`
 * already resolves `<...>` / bracket ALTs to SO terms, so a BND record arrives
 * typed `breakend` and nothing here has to know the spelling. A record with no
 * mate therefore never shows the row, rather than showing one that opens a
 * dialog with nothing to open.
 */
export function breakendSplitViewMenuItem(
  self: BreakendLaunchSelf,
  feature: Feature,
): MenuItem[] {
  return feature.get('type') === 'breakend' && hasBreakpointSplitView(self)
    ? [
        {
          label: SPLIT_VIEW_MENU_LABEL,
          icon: CompareArrowsIcon,
          onClick: () => {
            void withFeatureDetails(
              self,
              () => self.fetchFullRecord(feature),
              full => {
                launchFromFeature(self, full)
              },
            )
          },
        },
      ]
    : []
}

/**
 * Open the dialog on a resolved record, with the `findJunctionsNear` argument
 * that makes the dialog offer the whole chain of junctions rather than this one
 * record's two ends.
 */
function launchFromFeature(self: BreakendLaunchSelf, feature: Feature) {
  const view = containingLgv(self)
  const assemblyName = getAssemblyName(view)
  if (assemblyName && isAlive(self)) {
    launchBreakpointSplitView({
      session: getSession(self),
      view,
      assemblyName,
      feature,
      // these displays read the callset, so the dialog can offer to open the
      // whole chain of junctions rather than this one record's ends
      findJunctionsNear: makeFindJunctionsNear(self, assemblyName),
    })
  }
}
