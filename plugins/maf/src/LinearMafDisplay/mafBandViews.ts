/**
 * The MAF display's band stack and the heights it leaves the rows, on the
 * pure stacking in `mafTopBands.ts`: which bands draw, where each sits, the
 * rows' area under them, the track height, and the band drags.
 */
import { setConf } from '@jbrowse/core/configuration'
import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { dragBandHeight } from '@jbrowse/core/util/bandLayout'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'

import {
  dragRowsHiddenConservation,
  drawnMafTopBands,
  mafTopBands,
  rowsHiddenBandsHeight,
  rowsHiddenTrackHeight,
} from './mafTopBands.ts'

import type { MafRow } from '../types.ts'
import type { ConfigSlotSelf } from './configSlotViews.ts'
import type { MafBandKey } from './mafTopBands.ts'
import type { Band, BandPlot, BandStack } from '@jbrowse/core/util/bandLayout'

/** What {@link mafBandViews} reads: the band settings, the track height and the rows. */
export interface MafBandHost {
  showCoverage: boolean
  showConservation: boolean
  coverageHeight: number
  conservationHeight: number
  coarseTierActive: boolean
  showAlignments: boolean
  allottedHeight: number
  rowsLeadHeight: number
  rowsTopOffset: number
  drawnRows: MafRow[]
  rowsReported: boolean
  view: { initialized: boolean }
}

/** The band stack, coverage above conservation, and the rows' area under it. */
export function mafBandViews(self: MafBandHost) {
  return {
    /**
     * #getter
     * The coverage band is on and has data: `showCoverage` alone is not
     * enough, since the summary tier has no `coverage.coverageDepths`.
     *
     * `topBands` reads this as the band's `active` half, and the data
     * questions (autoscaling, the depth rules) read it directly; whatever
     * places something in the band reads `topBands.rects`. Only the track
     * menu reads `showCoverage`, so the tick keeps the user's choice
     * across zoom. Same split as `rowPlan` vs the slots it resolves.
     */
    get coverageBandActive() {
      return self.showCoverage && !self.coarseTierActive
    },
    /**
     * #getter
     * The conservation band is on and has data: twin of
     * `coverageBandActive`, since the identity scores are computed from
     * alignment blocks, which the summary tier lacks.
     *
     * `topBands` and the conservation encode read this; the menu tick
     * reads `showConservation`.
     */
    get conservationBandActive() {
      return self.showConservation && !self.coarseTierActive
    },
    /**
     * #getter
     * The plot the bands share with the rows: the track height less the
     * sidebar's lines above the rows, keeping the rows a floor while
     * they show.
     */
    get bandPlot() {
      return {
        height: self.allottedHeight - self.rowsLeadHeight,
        floor: self.showAlignments ? MIN_BAND_HEIGHT : 0,
      }
    },
    /**
     * #getter
     * Each band's switch and stated height, coverage above conservation.
     */
    get statedBands() {
      return {
        coverage: {
          active: this.coverageBandActive,
          height: self.coverageHeight,
        },
        conservation: {
          active: this.conservationBandActive,
          height: self.conservationHeight,
        },
      }
    },
    /**
     * #getter
     * The band stack as stated (`mafTopBands`): the stated heights bound
     * against `bandPlot`. The band drags read it, so hiding the rows
     * moves no stated height.
     */
    get statedTopBands() {
      return mafTopBands(this.statedBands, this.bandPlot)
    },
    /**
     * #getter
     * The band stack as drawn, coverage above conservation: the stated
     * stack while the rows show, and while they are hidden the bands
     * filling the plot (`drawnMafTopBands`), under the canvas's
     * backing-store limit: the conservation band at its stated height and
     * the coverage taking the rest, or with coverage off, the
     * conservation band alone. Every
     * top, height and offset reads this; a band that reserves 0 px does
     * not draw.
     */
    get topBands() {
      return drawnMafTopBands({
        bands: this.statedBands,
        plot: this.bandPlot,
        showRows: self.showAlignments,
        allottedHeight: self.allottedHeight,
        rowsLeadHeight: self.rowsLeadHeight,
      })
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: where the band stack ends. Every rows
     * hit-test, draw and export offset reads the mixin's `rowsTopOffset`
     * over it, so adding a band or the focus chip's line can't desync them.
     */
    get rowsHeaderHeight() {
      return this.topBands.bottom
    },
    /**
     * #getter
     * Number of displayed rows (at least 1, so dividing the rows' height
     * by it is safe).
     */
    get nrow() {
      return Math.max(1, self.drawnRows.length)
    },
    /**
     * #getter
     * Max CSS-px height the rows may take: one canvas holds the band
     * stack and the rows, and it stops where its backing store (`× dpr`)
     * hits the browser/GPU canvas limit, so the rows get what the bands
     * leave of that.
     */
    get maxRowsHeight() {
      return Math.max(0, maxCanvasCssPx() - self.rowsTopOffset)
    },
    /**
     * #getter
     * Height of the per-sample rows area, which the rows fit: the
     * track's `height` slot minus the stacked bands, never grown by the
     * row count, so more species shrink the rows rather than grow the
     * track. Zero when alignments are hidden. Capped at `maxRowsHeight`
     * so the canvas, bands plus rows, stays under its backing-store limit.
     */
    get rowsHeight() {
      return self.showAlignments
        ? Math.min(
            Math.max(0, self.allottedHeight - self.rowsTopOffset),
            this.maxRowsHeight,
          )
        : 0
    },
    /**
     * #getter
     * Per-row height: the rows area split evenly across the rows, so the
     * rows always fit the track and never scroll. A taller track or a
     * narrower row focus is how a reader gets taller rows.
     *
     * Sub-pixel is legitimate for more species than pixels; only a
     * non-positive height, which every consumer divides by, is floored
     * (agent-docs/reference/ROW_HEIGHT_AND_FIT.md).
     */
    get effectiveRowHeight() {
      const fit = this.rowsHeight / this.nrow
      return fit > 0 ? fit : 1
    },
    /**
     * #getter
     * The per-sample rows area has something to draw: the view can place
     * it, the rows have px and the row set is known. The `visible*`
     * getters share this gate instead of re-spelling it.
     */
    get rowsVisible() {
      return self.view.initialized && this.rowsHeight > 0 && self.rowsReported
    },
    /**
     * #getter
     */
    get scrollViewportHeight() {
      return this.rowsHeight
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: off while the alignments are hidden, since
     * the tree lays against rows that are not drawn.
     */
    get drawsTree() {
      return self.showAlignments
    },
    /**
     * #getter
     * Override BaseLinearDisplay.height so the track container matches the
     * rendering canvases exactly (stacked bands + rows viewport). With the
     * rows hidden the bands fill the track's own height, so a drag
     * resizes from it.
     */
    get height() {
      return self.showAlignments
        ? this.rowsHeight + self.rowsTopOffset
        : rowsHiddenTrackHeight(self.allottedHeight)
    },
  }
}

/** What {@link mafBandActions} reads: the stack as stated and its plot. */
export interface MafBandActionsHost extends ConfigSlotSelf {
  showAlignments: boolean
  allottedHeight: number
  rowsLeadHeight: number
  bandPlot: BandPlot
  statedBands: Record<MafBandKey, Band>
  statedTopBands: BandStack<MafBandKey>
}

/** The band drags, each bound to the room the stack leaves it. */
export function mafBandActions(self: MafBandActionsHost) {
  return {
    /**
     * #action
     * The coverage band's height, dragged as every band in a stack is
     * (`dragBandHeight`) to the room the other band and the rows' floor
     * leave.
     */
    setCoverageHeight(height: number) {
      setConf(
        self,
        ['coverage', 'height'],
        dragBandHeight(self.statedTopBands, 'coverage', self.bandPlot, height),
      )
    },
    /**
     * #action
     * The conservation band's height, dragged as `setCoverageHeight` is
     * while the rows show. While they are hidden the coverage takes what
     * the conservation band leaves, so the drag stops where the coverage
     * keeps its floor (`dragRowsHiddenConservation`).
     */
    setConservationHeight(height: number) {
      setConf(
        self,
        ['conservation', 'height'],
        self.showAlignments
          ? dragBandHeight(
              self.statedTopBands,
              'conservation',
              self.bandPlot,
              height,
            )
          : dragRowsHiddenConservation(
              self.statedBands.conservation,
              rowsHiddenBandsHeight(self),
              height,
            ),
      )
    },
  }
}
