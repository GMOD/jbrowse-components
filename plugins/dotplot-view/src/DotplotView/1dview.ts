import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { getParent } from '@jbrowse/mobx-state-tree'
import { regionSignature } from '@jbrowse/synteny-core'

import {
  axisBorderPx,
  getBlockLabelKeysToHide,
  makeTicks,
  regionBoundaryLines,
  thinTickPositions,
  tickLines,
  truncateRefNames,
} from './components/util.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

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
       * refName -> the string the axis prints for it. Off displayedRegions
       * rather than the visible blocks, so panning and zooming can't change a
       * label, and handed to `labelMarginPx` so the margin is sized against the
       * very strings drawn.
       */
      get refNameLabels() {
        return truncateRefNames(self.displayedRegions.map(r => r.refName))
      },

      /**
       * #getter
       * The margin this axis' labels need beside the plot. Derived from regions
       * and zoom only — never from the plot size — so it can't feed back
       * through the plot size into a render loop.
       */
      get labelMarginPx() {
        return axisBorderPx(
          self.displayedRegions,
          self.bpPerPx,
          this.refNameLabels,
        )
      },

      /**
       * #getter
       */
      get ticks() {
        return makeTicks(self.staticBlocks.contentBlocks, self.bpPerPx)
      },

      /**
       * #getter
       * The ticks that land on the drawn axis, thinned to what can be read and
       * flagged for labelling. Clipped before thinning: spacing is a question
       * about what is on screen, and offscreen ticks (staticBlocks run a screen
       * past each edge) would otherwise claim slots from visible ones.
       */
      get visibleTickPositions() {
        const { offsetPx, width } = self
        return thinTickPositions(
          this.ticks.flatMap(tick => {
            const alongPx = tick.px === undefined ? -1 : tick.px - offsetPx
            return alongPx > 0 && alongPx < width ? [{ tick, alongPx }] : []
          }),
        )
      },

      /**
       * #getter
       * Block-label keys whose labels would overlap, and are hidden
       */
      get blockLabelKeysToHide() {
        return getBlockLabelKeysToHide(
          this.dynamicBlocks.contentBlocks,
          self.width,
          self.offsetPx,
        )
      },

      /**
       * #getter
       * Signature of the displayed-region order and orientation, which a
       * diagonalize reorder/flip changes and a zoom or pan does not. Its own
       * primitive-valued computed so every display's fetch key reads it without
       * rebuilding a string per region on each wheel step.
       */
      get regionSignature() {
        return regionSignature(self.displayedRegions)
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

// The plot each axis hangs off, as what an axis reads back out of it.
// Duck-typed rather than imported: the view names these two axis models as its
// own properties, so importing `DotplotViewModel` here is a circular reference
// (ADR-055).
interface DotplotAxisParent {
  viewWidth: number
  viewHeight: number
  lockAspectRatio: boolean
  sharedFitBpPerPx: number
  showGridlines: boolean
}

// One axis of the plot, as long as the plot dimension it runs along. The
// vertical one lays out bottom-up, so its along-axis px are flipped into screen
// y through `toScreenPx`.
function plotAxis(length: 'viewWidth' | 'viewHeight') {
  return Dotplot1DView.extend(self => ({
    views: {
      get width() {
        return getParent<DotplotAxisParent>(self)[length]
      },

      // The zoom-out limit an axis of a PLOT has, which is not the same
      // question as "when does this axis' genome fit". Under the aspect-ratio
      // lock the two axes run at one shared bpPerPx, and for both genomes to fit
      // it has to be the LARGER of the two fits — legitimately past the shorter
      // axis' own, which is why `showAllRegions` sets exactly that. Clamping each
      // axis to its own made "zoom out" at full extent zoom the plot IN: zoomTo
      // pulled the shorter axis back while the longer held, and the lock then
      // squared the pair to their average. Here rather than in the view's zoom
      // actions so every route to a zoom obeys it.
      get maxBpPerPx() {
        const parent = getParent<DotplotAxisParent>(self)
        return parent.lockAspectRatio
          ? parent.sharedFitBpPerPx
          : self.fitBpPerPx
      },

      toScreenPx(alongPx: number) {
        return length === 'viewHeight' ? self.width - alongPx : alongPx
      },

      // Region-boundary lines in plot px, shared by the screen grid and the SVG
      // export so the two cannot drift, and read by `gridlines` to see which
      // pixels a boundary already owns
      get regionLines() {
        const { offsetPx, displayedRegionsTotalPx, width } = self
        return regionBoundaryLines(
          self.dynamicBlocks.contentBlocks,
          b => this.toScreenPx(b.offsetPx - offsetPx),
          this.toScreenPx(displayedRegionsTotalPx - offsetPx),
          width,
        )
      },

      // The faint coordinate lines this axis' ruler casts across the plot, in
      // its two weights: empty with the setting off, and whenever the axis
      // could not number itself anywhere — which at whole-genome zoom is the
      // usual case. All or nothing per axis; see `tickLines`.
      get gridlines() {
        return getParent<DotplotAxisParent>(self).showGridlines
          ? tickLines(
              self.visibleTickPositions,
              px => this.toScreenPx(px),
              this.regionLines,
            )
          : []
      },
    },
  }))
}

const DotplotHView = plotAxis('viewWidth')
const DotplotVView = plotAxis('viewHeight')

export { Dotplot1DView, DotplotHView, DotplotVView }
export type Dotplot1DViewModel = Instance<typeof Dotplot1DView>
export type DotplotPlotAxisModel = Instance<typeof DotplotHView>
