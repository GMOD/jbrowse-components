import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { sourcesFromRegionData } from '../LinearWiggleDisplay/sourcesLogic.ts'
import { wiggleSharesPanel } from './wiggleColor.ts'

import type { Source } from '../util.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

/** What {@link wiggleRowHookViews} reads: the fetched scores and the layout. */
export interface WiggleRowHookHost {
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  isRowLayout: boolean
  discoveredRows: Source[]
}

/**
 * The `TreeSidebarMixin` hooks a wiggle display answers for its rows, which
 * the display and a static export install over the same row views.
 */
export function wiggleRowHookViews(self: WiggleRowHookHost) {
  // This list reaches `gpuProps()`, whose identity re-encodes every loaded
  // region, and a plain getter would hand out a fresh array on every region
  // arrival — `stableIdentityComputed` keeps the previous one while the row
  // metadata is unchanged, which is what a refetch of the same track
  // produces.
  const sources = stableIdentityComputed(() =>
    sourcesFromRegionData(self.rpcDataMap),
  )
  return {
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the adapter's sources, discovered from
     * the loaded regions in adapter order.
     */
    get discoveredRows(): Source[] {
      return sources.get()
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: whether several plots share one box, where
     * only color tells the sources apart. A lone plot has nothing to be
     * told apart from and is the pos/neg picture a quantitative track has
     * always drawn.
     */
    get sharesPanel(): boolean {
      return wiggleSharesPanel(self.isRowLayout, self.discoveredRows.length)
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the row color key over a shared panel
     * lists subtracks.
     */
    get rowNoun(): string {
      return 'Subtrack'
    },
  }
}
