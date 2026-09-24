import { coverageBandMarks } from '@jbrowse/alignments-core'
import { defineMark, spanMark } from '@jbrowse/render-core/marks'

import { GAP_STROKE_OFFSET } from './rendering/types.ts'

import type {
  MafCoverageRegion,
  MafGPURenderState,
  MafRowsPayload,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type {
  Mark,
  MarkShape,
  SpanChannels,
  SpanParams,
} from '@jbrowse/render-core/marks'

const rowsBand = (s: MafGPURenderState) => ({
  top: s.rowsTop,
  height: s.rowsHeight,
})

/**
 * The rows band, as a declaration: one `span` mark per run of same-coloured
 * cells, its channels already encoded by `buildMafChannels`, clipped to the
 * rows viewport under the band stack.
 *
 * `scrollTop` is the shape's scroll offset less `rowsTop`, which places the
 * band inside a canvas that also carries the coverage strip above it: the shape
 * paints row i at `rowHeight*i - scrollTop`, so offsetting the scroll is
 * offsetting the band.
 */
export const MAF_ROW_MARK = defineMark({
  shape: spanMark,
  channels: (d: MafRowsPayload) => d.cells,
  params: (s: MafGPURenderState) => ({
    rowHeight: s.rowHeight,
    rowProportion: s.rowProportion,
    // MAF does not floor. Its cells tile the row, so a sub-pixel cell is read
    // as part of the run around it, and widening one to a whole pixel paints
    // ink the alignment does not contain: measured at 2.3x the colour of a
    // supersampled ground truth, against 1.05x for no floor
    // (agent-docs/reference/MAF_SUBPIXEL_CELLS.md).
    minWidthPx: 0,
    seamPx: GAP_STROKE_OFFSET,
    scrollTop: s.scrollTop - s.rowsTop,
  }),
  band: rowsBand,
})

// A pass id keys the instance buffer, so a second `span` mark needs its own.
function spanPass(id: string): MarkShape<SpanChannels, SpanParams> {
  return { ...spanMark, id, pass: { ...spanMark.pass, id } }
}

/**
 * One block per row, where the rows band draws each block whole rather than
 * base by base. Unlike the cells these are sparse intervals, so a block
 * narrower than a pixel is widened to one and still reads as present.
 */
export const MAF_SOURCE_CHROM_MARK = defineMark({
  shape: spanPass('mafSourceChrom'),
  channels: (d: MafRowsPayload) => d.sourceChrom,
  params: (s: MafGPURenderState) => ({
    rowHeight: s.rowHeight,
    rowProportion: s.rowProportion,
    minWidthPx: 1,
    seamPx: 0,
    scrollTop: s.scrollTop - s.rowsTop,
  }),
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

/** The rows band's marks, in paint order. */
export const MAF_ROWS_MARKS: Mark<MafRowsPayload, MafGPURenderState>[] = [
  MAF_ROW_MARK,
  MAF_SOURCE_CHROM_MARK,
]

/** Everything the rows canvas draws, in paint order. */
export const MAF_MARKS: Mark<MafUploadPayload, MafGPURenderState>[] = [
  ...MAF_COVERAGE_MARKS,
  ...MAF_ROWS_MARKS,
]
