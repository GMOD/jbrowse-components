/**
 * The bands a MAF display stacks above its rows, coverage over
 * conservation, as one pure function. The layout reserving each strip and
 * every reader placing something in it — the render state, the marks, the
 * export, the handles, the labels, the axes and the tooltip — take the band
 * from here.
 */
import {
  boundStackedBands,
  fillStackedBands,
  stackBands,
} from '@jbrowse/core/util/bandLayout'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'

import type { Band, BandPlot, BandStack } from '@jbrowse/core/util/bandLayout'

export const MAF_BAND_ORDER = ['coverage', 'conservation'] as const

export type MafBandKey = (typeof MAF_BAND_ORDER)[number]

/** Where a band sits on the canvas and how many px it reserves. */
export interface MafBandRect {
  top: number
  height: number
}

export interface MafTopBands extends BandStack<MafBandKey> {
  rects: Record<MafBandKey, MafBandRect>
}

function rectOf(stack: BandStack<MafBandKey>, key: MafBandKey) {
  return { top: stack.top[key], height: stack.reserved[key] }
}

function withRects(stack: BandStack<MafBandKey>) {
  return {
    ...stack,
    rects: {
      coverage: rectOf(stack, 'coverage'),
      conservation: rectOf(stack, 'conservation'),
    },
  }
}

/**
 * The stated heights bound against the plot the bands share with the rows
 * (`boundStackedBands`), folded into tops and a bottom, with each band's
 * rect beside the fold.
 */
export function mafTopBands(bands: Record<MafBandKey, Band>, plot: BandPlot) {
  return withRects(
    stackBands(MAF_BAND_ORDER, boundStackedBands(MAF_BAND_ORDER, bands, plot)),
  )
}

/**
 * The bands filling the whole plot, for a track whose rows are hidden: the
 * bound stated heights scaled in proportion to fill `plot.height`
 * (`fillStackedBands`), folded as {@link mafTopBands} folds them.
 */
export function filledMafTopBands(
  bands: Record<MafBandKey, Band>,
  plot: BandPlot,
) {
  const bound = boundStackedBands(MAF_BAND_ORDER, bands, plot)
  const filled = fillStackedBands(MAF_BAND_ORDER, bound, plot.height)
  return withRects(
    stackBands(MAF_BAND_ORDER, {
      coverage: { active: bound.coverage.active, height: filled('coverage') },
      conservation: {
        active: bound.conservation.active,
        height: filled('conservation'),
      },
    }),
  )
}

/**
 * The height a track whose rows are hidden draws at: its own, under the
 * canvas's backing-store limit, since the bands fill it.
 */
export function rowsHiddenTrackHeight(allottedHeight: number) {
  return Math.min(allottedHeight, maxCanvasCssPx())
}

/**
 * The bands as drawn: the stated stack ({@link mafTopBands}) while the rows
 * show, and while they are hidden the bands filling the plot
 * ({@link filledMafTopBands}) under the track's {@link rowsHiddenTrackHeight},
 * less the lines the sidebar keeps above the rows.
 */
export function drawnMafTopBands({
  bands,
  plot,
  showRows,
  allottedHeight,
  rowsLeadHeight,
}: {
  bands: Record<MafBandKey, Band>
  plot: BandPlot
  showRows: boolean
  allottedHeight: number
  rowsLeadHeight: number
}) {
  return showRows
    ? mafTopBands(bands, plot)
    : filledMafTopBands(bands, {
        ...plot,
        height: rowsHiddenTrackHeight(allottedHeight) - rowsLeadHeight,
      })
}
