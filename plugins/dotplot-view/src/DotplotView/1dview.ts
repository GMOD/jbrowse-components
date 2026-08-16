import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { getParent } from '@jbrowse/mobx-state-tree'

import type { Instance, IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel Dotplot1DView
 * #category general
 * one axis of a dotplot. categorized General rather than View because it is not
 * a pluggable view type, which the name-suffix heuristic would otherwise assume
 * ref https://mobx-state-tree.js.org/concepts/volatiles on volatile state used here
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
       * The zoom that fits this axis' whole genome, with a tenth of the axis to
       * spare. Its own getter, separate from `maxBpPerPx`, because on a locked
       * plot the two differ — see `DotplotHView`.
       */
      get fitBpPerPx() {
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
      get maxBpPerPx(): number {
        return this.fitBpPerPx
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

// The plot each axis hangs off, as the four things an axis reads back out of
// it. Duck-typed rather than imported: the view names these two axis models as
// its own properties, so importing `DotplotViewModel` here is a circular
// reference (ADR-055).
interface DotplotAxisParent {
  viewWidth: number
  viewHeight: number
  lockAspectRatio: boolean
  sharedFitBpPerPx: number
}

// An axis, as the one thing the helper below needs off it.
interface DotplotAxisSelf extends IStateTreeNode {
  fitBpPerPx: number
}

// The zoom-out limit an axis of a PLOT has, which is not the same question as
// "when does this axis' genome fit". Under the aspect-ratio lock the two axes
// run at one shared bpPerPx, and for both genomes to fit it has to be the LARGER
// of the two fits — legitimately past the shorter axis' own, which is why
// `showAllRegions` sets exactly that.
//
// Clamping each axis to its own instead is what made "zoom out" at full extent
// zoom the plot IN: `Base1DView.zoomTo` pulled the shorter axis back to its own
// fit while the longer one held, and the lock autorun then squared the pair to
// the average of the two — so a click meant to widen the plot narrowed it, and
// no number of clicks could return to the `showAllRegions` state.
//
// Resolved here rather than in the view's zoom actions so that every route to a
// zoom obeys it — the buttons, the wheel, box-zoom, and `showAllRegions` itself,
// which is now a plain `zoomTo(maxBpPerPx)` per axis.
function axisMaxBpPerPx(self: DotplotAxisSelf) {
  const parent = getParent<DotplotAxisParent>(self)
  return parent.lockAspectRatio ? parent.sharedFitBpPerPx : self.fitBpPerPx
}

const DotplotHView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<DotplotAxisParent>(self).viewWidth
    },
    get maxBpPerPx() {
      return axisMaxBpPerPx(self)
    },
  },
}))

const DotplotVView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<DotplotAxisParent>(self).viewHeight
    },
    get maxBpPerPx() {
      return axisMaxBpPerPx(self)
    },
  },
}))

export { Dotplot1DView, DotplotHView, DotplotVView }
export type Dotplot1DViewModel = Instance<typeof Dotplot1DView>
