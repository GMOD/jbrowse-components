import { coverageBandMarks, insertionMark } from '@jbrowse/alignments-core'
import { barMark, defineMark, spanMark } from '@jbrowse/render-core/marks'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import { conservationBarBand } from '../LinearMafDisplay/components/conservationBand.ts'
import { GAP_STROKE_OFFSET } from './rendering/types.ts'

import type {
  MafCoverageRegion,
  MafGPURenderState,
  MafRowsPayload,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { Mark, MarkShape } from '@jbrowse/render-core/marks'

const rowsBand = (s: MafGPURenderState) => ({
  top: s.rowsTop,
  height: s.rowsHeight,
})

/**
 * The params of a `span` mark tiling each row base by base, as the cells do.
 *
 * `scrollTop` is the shape's scroll offset less `rowsTop`, which places the
 * band inside a canvas that also carries the coverage strip above it: the shape
 * paints row i at `rowHeight*i - scrollTop`, so offsetting the scroll is
 * offsetting the band.
 *
 * MAF does not floor. Its cells tile the row, so a sub-pixel cell is read as
 * part of the run around it, and widening one to a whole pixel paints ink the
 * alignment does not contain: measured at 2.3x the color of a supersampled
 * ground truth, against 1.05x for no floor
 * (agent-docs/reference/MAF_LARGE_BLOCKS.md).
 */
const cellSpanParams = (s: MafGPURenderState) => ({
  rowHeight: s.rowHeight,
  rowProportion: s.rowProportion,
  minWidthPx: 0,
  seamPx: GAP_STROKE_OFFSET,
  scrollTop: s.scrollTop - s.rowsTop,
})

/**
 * The params of a mark drawing each block of a row whole rather than base by
 * base. Unlike the cells these are sparse intervals, so a block narrower than a
 * pixel is widened to one and still reads as present.
 */
const blockSpanParams = (s: MafGPURenderState) => ({
  ...cellSpanParams(s),
  minWidthPx: 1,
  seamPx: 0,
})

/** Where a row's drawn band starts within its slot, on the canvas, and its height. */
function rowBandPx(s: MafGPURenderState) {
  return {
    offsetPx:
      s.rowsTop + rowBandOffsetPx(s.rowHeight, s.rowProportion) - s.scrollTop,
    heightPx: drawnRowHeightPx(s.rowHeight, s.rowProportion),
  }
}

/**
 * The rows band, as a declaration: one `span` mark per run of same-colored
 * cells, its channels already encoded by `buildMafChannels`, clipped to the
 * rows viewport under the band stack.
 */
export const MAF_ROW_MARK = defineMark({
  shape: spanMark,
  channels: (d: MafRowsPayload) => d.cells,
  params: cellSpanParams,
  band: rowsBand,
})

// A pass id keys the instance buffer, so a second mark of a shape needs its own.
function passOf<C, P>(shape: MarkShape<C, P>, id: string): MarkShape<C, P> {
  return { ...shape, id, pass: { ...shape.pass, id } }
}

/** The identity heatmap: each row's mean identity per window, tiling like the cells. */
export const MAF_IDENTITY_MARK = defineMark({
  shape: passOf(spanMark, 'mafIdentity'),
  channels: (d: MafRowsPayload) => d.identity,
  params: cellSpanParams,
  band: rowsBand,
})

/**
 * The identity X-Y plot: a bar per window standing from each row band's
 * bottom to its identity, the band the cells would fill.
 */
export const MAF_IDENTITY_BAR_MARK = defineMark({
  shape: passOf(barMark, 'mafIdentityBar'),
  channels: (d: MafRowsPayload) => d.identityBars,
  params: (s: MafGPURenderState) => {
    const { offsetPx, heightPx } = rowBandPx(s)
    return {
      domain: [0, 1] as [number, number],
      origin: 0,
      minWidthPx: 0,
      seamPx: GAP_STROKE_OFFSET,
      rowHeight: s.rowHeight,
      rowBandPx: heightPx,
      rowOffsetPx: offsetPx,
    }
  },
  band: rowsBand,
})

/** The codon view: each species' codon cells, filled by its change. */
export const MAF_CODON_MARK = defineMark({
  shape: passOf(spanMark, 'mafCodon'),
  channels: (d: MafRowsPayload) => d.codonCells,
  params: blockSpanParams,
  band: rowsBand,
})

/**
 * The conservation band below the coverage band: a bar per window or codon,
 * inset by the same margin as the coverage band so its axis ends meet it.
 */
export const MAF_CONSERVATION_MARK = defineMark({
  shape: passOf(barMark, 'mafConservation'),
  channels: (d: MafRowsPayload) => d.conservation,
  params: (s: MafGPURenderState) => {
    const inset = conservationBarBand(s.conservation.height)
    return {
      domain: [0, 1] as [number, number],
      origin: 0,
      minWidthPx: 0,
      seamPx: GAP_STROKE_OFFSET,
      rowHeight: inset.height,
      rowBandPx: inset.height,
      rowOffsetPx: s.conservation.top + inset.top,
    }
  },
  band: (s: MafGPURenderState) => s.conservation,
})

/** Each row's aligned blocks, colored by their `refNameRank`. */
export const MAF_REF_NAME_RANK_MARK = defineMark({
  shape: passOf(spanMark, 'mafRefNameRank'),
  channels: (d: MafRowsPayload) => d.refNameRank,
  params: blockSpanParams,
  band: rowsBand,
})

/** The summary tier's per-species presence bars, shaded by score. */
export const MAF_SUMMARY_MARK = defineMark({
  shape: passOf(spanMark, 'mafSummary'),
  channels: (d: MafRowsPayload) => d.summary,
  params: blockSpanParams,
  band: rowsBand,
})

/**
 * The coverage strip pinned at the canvas top: the shared band's four layers
 * (a MAF alignment carries no modification calls) over the worker's own
 * per-region coverage. Declared over `{ coverage }` rather than the upload
 * payload so the SVG export paints it straight off `rpcDataMap`.
 */
export const MAF_COVERAGE_MARKS = coverageBandMarks({
  channels: (d: { coverage: MafCoverageRegion }) => d.coverage,
  state: (s: MafGPURenderState) => s.coverage,
  band: s => ({ top: 0, height: s.coverage.height }),
})

/**
 * Each species' insertions over its cells, interbase at their anchors, on the
 * cells' band.
 */
export function mafInsertionParams(s: MafGPURenderState) {
  const { offsetPx, heightPx } = rowBandPx(s)
  return {
    rowHeight: s.rowHeight,
    rowOffsetPx: offsetPx,
    bandHeightPx: heightPx,
    spanFloorPx: 0,
    outline: false,
  }
}

export const MAF_INSERTION_MARK = defineMark({
  shape: insertionMark,
  channels: (d: MafRowsPayload) => d.insertions,
  params: mafInsertionParams,
  band: rowsBand,
})

/**
 * The rows band's marks, in paint order: the fills a field draws, then the
 * cells, which carry a constant fill or, over a field's, only the bases that
 * paint, then the codon layer and the insertions over them.
 */
export const MAF_ROWS_MARKS: Mark<MafRowsPayload, MafGPURenderState>[] = [
  MAF_IDENTITY_MARK,
  MAF_IDENTITY_BAR_MARK,
  MAF_REF_NAME_RANK_MARK,
  MAF_SUMMARY_MARK,
  MAF_ROW_MARK,
  MAF_CODON_MARK,
  MAF_INSERTION_MARK,
]

/** Everything the rows canvas draws, in paint order. */
export const MAF_MARKS: Mark<MafUploadPayload, MafGPURenderState>[] = [
  ...MAF_COVERAGE_MARKS,
  MAF_CONSERVATION_MARK,
  ...MAF_ROWS_MARKS,
]
