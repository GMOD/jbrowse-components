/**
 * The bands a MAF display stacks above its rows, coverage over
 * conservation, as one pure function. The layout reserving each strip and
 * every reader placing something in it — the render state, the marks, the
 * export, the handles, the labels, the axes and the tooltip — take the band
 * from here.
 */
import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import {
  boundStackedBands,
  dragBandHeight,
  fillStackedBands,
  reservedPx,
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

// The conservation band alone, at its stated height bound to the room that
// leaves the coverage above it its floor of `height`, and folded.
function conservationUnderCoverage(conservation: Band, height: number) {
  const plot = { height, floor: MIN_BAND_HEIGHT }
  return {
    plot,
    stack: stackBands(
      ['conservation'],
      boundStackedBands(['conservation'], { conservation }, plot),
    ),
  }
}

function remainderHeights(bands: Record<MafBandKey, Band>, height: number) {
  const { stack } = conservationUnderCoverage(bands.conservation, height)
  return {
    coverage: height - stack.bottom,
    conservation: stack.height.conservation,
  }
}

function proportionalHeights(bands: Record<MafBandKey, Band>, height: number) {
  const filled = fillStackedBands(
    MAF_BAND_ORDER,
    boundStackedBands(MAF_BAND_ORDER, bands, { height, floor: 0 }),
    height,
  )
  return { coverage: filled('coverage'), conservation: filled('conservation') }
}

/**
 * The bands filling `height`, for a track whose rows are hidden. With
 * coverage, the conservation band keeps its stated height and the coverage
 * takes the rest, so the coverage's stated height has no say; without it, the
 * bound stated heights scale in proportion (`fillStackedBands`). Folded as
 * {@link mafTopBands} folds them.
 */
export function filledMafTopBands(
  bands: Record<MafBandKey, Band>,
  height: number,
) {
  const filled =
    reservedPx(bands.coverage) > 0
      ? remainderHeights(bands, height)
      : proportionalHeights(bands, height)
  return withRects(
    stackBands(MAF_BAND_ORDER, {
      coverage: { active: bands.coverage.active, height: filled.coverage },
      conservation: {
        active: bands.conservation.active,
        height: filled.conservation,
      },
    }),
  )
}

/**
 * One drag of the conservation band while the rows are hidden, the coverage
 * taking the rest of `height`: from `MIN_BAND_HEIGHT` up to the room that
 * leaves the coverage its floor.
 */
export function dragRowsHiddenConservation(
  conservation: Band,
  height: number,
  target: number,
) {
  const { stack, plot } = conservationUnderCoverage(conservation, height)
  return dragBandHeight(stack, 'conservation', plot, target)
}

/**
 * Where band `key`'s resize handle sits and whether a drag down lowers its
 * height, or undefined where it has none. A band reserving no px has none.
 * With the rows shown the handle sits on the band's bottom seam. With them
 * hidden the coverage takes what the conservation band leaves, so it has no
 * handle, and the conservation band's sits on its top seam.
 */
export function mafBandHandle(
  rects: Record<MafBandKey, MafBandRect>,
  key: MafBandKey,
  showRows: boolean,
) {
  const { top, height } = rects[key]
  return height > 0
    ? showRows
      ? { seam: top + height, reverse: false }
      : key === 'conservation' && rects.coverage.height > 0
        ? { seam: top, reverse: true }
        : undefined
    : undefined
}

/**
 * The height a track whose rows are hidden draws at: its own, under the
 * canvas's backing-store limit, since the bands fill it.
 */
export function rowsHiddenTrackHeight(allottedHeight: number) {
  return Math.min(allottedHeight, maxCanvasCssPx())
}

/**
 * The height the bands fill while the rows are hidden: the track's
 * {@link rowsHiddenTrackHeight}, less the lines the sidebar keeps above the
 * rows.
 */
export function rowsHiddenBandsHeight({
  allottedHeight,
  rowsLeadHeight,
}: {
  allottedHeight: number
  rowsLeadHeight: number
}) {
  return rowsHiddenTrackHeight(allottedHeight) - rowsLeadHeight
}

/**
 * The bands as drawn: the stated stack ({@link mafTopBands}) while the rows
 * show, and while they are hidden the bands filling
 * {@link rowsHiddenBandsHeight} ({@link filledMafTopBands}).
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
    : filledMafTopBands(
        bands,
        rowsHiddenBandsHeight({ allottedHeight, rowsLeadHeight }),
      )
}
