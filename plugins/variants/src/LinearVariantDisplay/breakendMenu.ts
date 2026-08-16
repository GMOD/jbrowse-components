import { withFeatureDetails } from '@jbrowse/core/util'
import { hasBreakpointSplitView } from '@jbrowse/sv-core'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'

import { launchFromFeature } from '../shared/breakendSplitViewMenuItem.ts'
import { SPLIT_VIEW_MENU_LABEL } from './labels.ts'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The right-click that opened the menu, as much of it as this item needs.
interface BreakendMenuSelf extends IStateTreeNode {
  contextMenuInfo?: {
    item: { featureId: string; type: string | undefined }
    displayedRegionIndex: number
  }
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
  // what `makeFindJunctionsNear` queries to continue a chain past the record
  adapterConfig: Record<string, unknown>
}

// One row, appended to the variant feature menu on a breakend record.
//
// It exists because the split view was otherwise reachable only through the
// feature details panel, below whatever INFO the caller wrote: on COLO829's
// nanomonsv VCF that is a hundred rows of SnpEff ANN, so the link sits under a
// table the user has to scroll past to find out it is there. Right-clicking the
// record is where a reader looks first (review: "making it as easy as possible
// is also valuable").
//
// Gated on the feature's own type rather than on parsing its ALT: VcfFeature
// already resolves `<...>` / bracket ALTs to SO terms, so a BND record arrives
// typed `breakend` and nothing here has to know the spelling. Records with no
// mate therefore never show the row, rather than showing one that opens a
// dialog with nothing to open.
//
// This display's half is the **fetch**: it paints from slim render arrays, so
// the record has to be re-fetched to be launched from — the dialog resolves the
// mate off the feature's own ALT/INFO, which the hit item does not carry (same
// fetch the menu's "Open variant details" row makes). The launch itself is
// `launchFromFeature`, shared with the multi-sample displays, whose context menu
// is built from a feature it already holds and which therefore needs no fetch.
export function breakendMenuItems(self: BreakendMenuSelf): MenuItem[] {
  const info = self.contextMenuInfo
  if (info?.item.type !== 'breakend' || !hasBreakpointSplitView(self)) {
    return []
  }
  const { featureId } = info.item
  const { displayedRegionIndex } = info
  return [
    {
      label: SPLIT_VIEW_MENU_LABEL,
      icon: CompareArrowsIcon,
      onClick: () => {
        void withFeatureDetails(
          self,
          () => self.fetchFullFeature(featureId, displayedRegionIndex),
          feature => {
            launchFromFeature(self, feature)
          },
        )
      },
    },
  ]
}
