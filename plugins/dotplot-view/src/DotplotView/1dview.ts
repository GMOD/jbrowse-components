import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { getParent } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel Dotplot1DView
 * #category general
 * one axis of a dotplot. categorized General rather than View because it is not
 * a pluggable view type, which the name-suffix heuristic would otherwise assume
 * ref https://@jbrowse/mobx-state-tree.js.org/concepts/volatiles on volatile state used here
 */
const Dotplot1DView = Base1DView.extend(self => {
  return {
    views: {
      /**
       * #getter
       * this uses padding=false and elision=false
       */
      get dynamicBlocks() {
        return calculateDynamicBlocks(self, false, false)
      },

      /**
       * #getter
       * The on-screen content blocks under the field names
       * `LinearGenomeView.visibleRegions` uses, so this axis and a synteny row
       * hand the shared comparative fetch window (`syntenyFetchRegions`) the
       * same thing and the two displays' `fetchRegions` are one call each.
       * Carries only what that window reads; the screen-px pair an LGV also
       * exposes has no reader here, and deriving it would make this recompute
       * with `offsetPx`.
       */
      get visibleRegions() {
        return this.dynamicBlocks.contentBlocks.map(block => ({
          refName: block.refName,
          start: block.start,
          end: block.end,
          assemblyName: block.assemblyName,
          reversed: block.reversed,
          // set by calculateDynamicBlocks on every content block; optional only
          // on the base block type, which also covers the elided/inter-region
          // blocks this list has neither of
          displayedRegionIndex: block.displayedRegionIndex!,
        }))
      },

      /**
       * #getter
       */
      get maxBpPerPx() {
        // Floor the divisor. This axis' width is the view's viewWidth/viewHeight,
        // which bottom out at 0 when the container is narrower than the axis
        // borders (they have their own MIN_BORDER floor) — and totalBp/0 is
        // Infinity, which showAllRegions would then zoomTo. Core's own
        // Base1DViewModel.showAllRegions guards its divisor the same way.
        return self.totalBp / Math.max(self.width * 0.9, 1)
      },

      /**
       * #getter
       */
      get minBpPerPx() {
        return 1 / 50
      },

      /**
       * #getter
       * One rule at every zoom level: scroll until only `leftPadding` px of
       * content remain visible on the right, or `rightPadding` px on the left.
       *
       * Deliberately NOT special-cased for content narrower than the view.
       * Pinning both bounds to the centered offset there gives zoomTo — which
       * clamps its anchor-preserving offset into [minOffset, maxOffset] — a
       * degenerate range, so the cursor anchor is silently discarded and the
       * plot snaps back to centered. That was the max-zoom-out "edge jump": the
       * first zoom step displaced the locus under the cursor by the
       * centered-vs-anchored gap, which grows with distance from center (~41px
       * near the edge, ~0 at the center). `center()` still centers explicitly,
       * so the initial view is unchanged.
       */
      get maxOffset() {
        const leftPadding = 10
        return self.displayedRegionsTotalPx - leftPadding
      },

      /**
       * #getter
       */
      get minOffset() {
        const rightPadding = 30
        return -self.width + rightPadding
      },
    },
    actions: {
      /**
       * #action
       */
      center() {
        const centerBp = self.totalBp / 2
        const centerPx = centerBp / self.bpPerPx
        self.scrollTo(centerPx - self.width / 2)
      },
    },
  }
})

const DotplotHView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<{ viewWidth: number }>(self).viewWidth
    },
  },
}))

const DotplotVView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<{ viewHeight: number }>(self).viewHeight
    },
  },
}))

export { Dotplot1DView, DotplotHView, DotplotVView }
export type Dotplot1DViewModel = Instance<typeof Dotplot1DView>
