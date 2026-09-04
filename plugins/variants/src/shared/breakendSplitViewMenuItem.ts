import { getSession } from '@jbrowse/core/util'
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
}

/**
 * The "open breakpoint split view" row, for a display that already holds the
 * resolved record.
 *
 * Every variant display in this plugin wants this row on a breakend and they
 * differ only in how they get hold of the feature: `LinearVariantDisplay` ships
 * slim render arrays and has to re-fetch it (`breakendMenuItems` wraps this with
 * that fetch), while the multi-sample displays' context menu is built from a
 * `contextMenuInfo` whose feature is already a `Feature`. Factoring on *that* line —
 * "here is the record" — is what lets the second one reuse this without
 * growing a `fetchFullFeature` it has no use for.
 *
 * Gated on the feature's own type rather than on parsing its ALT: `VcfFeature`
 * already resolves `<...>` / bracket ALTs to SO terms, so a BND record arrives
 * typed `breakend` and nothing here has to know the spelling. A record with no
 * mate therefore never shows the row, rather than showing one that opens a
 * dialog with nothing to open.
 */
export function breakendSplitViewMenuItem(
  self: BreakendLaunchSelf,
  feature: Feature | undefined,
): MenuItem[] {
  return feature?.get('type') === 'breakend' && hasBreakpointSplitView(self)
    ? [
        {
          label: SPLIT_VIEW_MENU_LABEL,
          icon: CompareArrowsIcon,
          onClick: () => {
            launchFromFeature(self, feature)
          },
        },
      ]
    : []
}

/**
 * Open the dialog on a resolved record. Separate from the row above so
 * `breakendMenuItems`' fetch-then-launch path lands in exactly the same call —
 * the `findJunctionsNear` argument in particular, which is what makes the dialog
 * offer the whole chain of junctions rather than this one record's two ends, and
 * which is easy to forget in a second copy.
 */
export function launchFromFeature(self: BreakendLaunchSelf, feature: Feature) {
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
